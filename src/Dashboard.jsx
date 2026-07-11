import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getOrders,
  getOrder,
  getMenu,
  updateOrderStatus as apiUpdateStatus,
  confirmPayment as apiConfirmPayment,
  cancelOrder as apiCancelOrder,
  acknowledgeOrder as apiAcknowledgeOrder,
  toggleMenuAvailability as apiToggleAvailability,
  extractErrorMessage,
} from './api'
import supabase from './supabaseClient'
import './Dashboard.css'

const TABS = ['Active', 'Ready', 'All Today', 'Menu']
const AUTO_REFRESH_INTERVAL = 60000 // 60s fallback

function Dashboard() {
  // ── State ───────────────────────────────────────
  const [ordersMap, setOrdersMap] = useState(new Map())
  const [activeTab, setActiveTab] = useState('Active')
  const [error, setError] = useState('')
  const [menuItems, setMenuItems] = useState([])
  const [menuLoading, setMenuLoading] = useState(false)

  const audioCtx = useRef(null)
  const bellInterval = useRef(null)
  const autoRefreshRef = useRef(null)

  // ── Audio helpers ───────────────────────────────
  function ensureAudioCtx() {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtx.current
  }

  function playBell() {
    const ctx = ensureAudioCtx()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5)
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 1)
  }

  function startRinging() {
    const ctx = ensureAudioCtx()
    ctx.resume().then(() => {
      playBell()
      if (!bellInterval.current) {
        bellInterval.current = setInterval(() => {
          playBell()
        }, 2000)
      }
    })
  }

  function stopRinging() {
    if (bellInterval.current) {
      clearInterval(bellInterval.current)
      bellInterval.current = null
    }
  }

  function unlockAudio() {
    ensureAudioCtx().resume()
  }

  // ── Check if bell should ring ───────────────────
  // Uses order.acknowledged from DB — syncs across all devices
  const checkBellState = useCallback((map) => {
    let unackedReceived = 0
    map.forEach((order) => {
      if (order.status === 'received' && !order.acknowledged) {
        unackedReceived++
      }
    })
    if (unackedReceived === 0) {
      stopRinging()
    }
  }, [])

  // ── Merge order into map ────────────────────────
  const mergeOrder = useCallback((order) => {
    setOrdersMap(prev => {
      const next = new Map(prev)
      next.set(order.id, order)
      return next
    })
  }, [])

  // ── Fetch orders ────────────────────────────────
  const fetchOrders = useCallback(() => {
    setError('')
    getOrders()
      .then(data => {
        const map = new Map()
        const list = Array.isArray(data) ? data : []
        list.forEach(order => map.set(order.id, order))
        setOrdersMap(map)
      })
      .catch(err => {
        setError(extractErrorMessage(err))
      })
  }, [])

  // ── Fetch menu items for Menu tab ───────────────
  const fetchMenuItems = useCallback(() => {
    setMenuLoading(true)
    getMenu()
      .then(data => {
        setMenuItems(Array.isArray(data) ? data : [])
        setMenuLoading(false)
      })
      .catch(() => {
        setMenuLoading(false)
      })
  }, [])

  // ── Initial fetch + realtime subscription ───────
  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          getOrder(payload.new.id)
            .then(fullOrder => {
              mergeOrder(fullOrder)
              // Only ring immediately for cash orders — UPI orders ring when payment is confirmed
              if (fullOrder.payment_method !== 'upi') {
                startRinging()
              }
            })
            .catch(() => {
              mergeOrder(payload.new)
              if (payload.new.payment_method !== 'upi') {
                startRinging()
              }
            })
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const prev = payload.old
          const next = payload.new
          mergeOrder(next)
          // Ring when a UPI payment is confirmed
          if (
            next.payment_method === 'upi' &&
            next.payment_status === 'confirmed' &&
            prev.payment_status !== 'confirmed'
          ) {
            startRinging()
          }
        }
      )
      .subscribe((status) => {
        // Fix #14 — auto-reconnect on channel error
        if (status === 'CHANNEL_ERROR') {
          setTimeout(() => {
            supabase.removeChannel(channel)
            fetchOrders()
          }, 3000)
        }
      })

    // Auto-refresh fallback every 60s
    autoRefreshRef.current = setInterval(fetchOrders, AUTO_REFRESH_INTERVAL)

    return () => {
      supabase.removeChannel(channel)
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
      stopRinging()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Check bell whenever orders change ───────────
  useEffect(() => {
    checkBellState(ordersMap)
  }, [ordersMap, checkBellState])

  // ── Fetch menu when Menu tab is opened ──────────
  useEffect(() => {
    if (activeTab === 'Menu') {
      fetchMenuItems()
    }
  }, [activeTab, fetchMenuItems])

  // ── Actions ─────────────────────────────────────
  function handleUpdateStatus(orderId, status) {
    // Optimistic update
    setOrdersMap(prev => {
      const next = new Map(prev)
      const order = next.get(orderId)
      if (order) next.set(orderId, { ...order, status })
      return next
    })

    apiUpdateStatus(orderId, status).catch(err => {
      setError(extractErrorMessage(err))
      fetchOrders() // rollback on error
    })
  }

  function handleConfirmPayment(orderId) {
    // Optimistic update — also auto-acknowledge since staff is clearly looking at this order
    setOrdersMap(prev => {
      const next = new Map(prev)
      const order = next.get(orderId)
      if (order) next.set(orderId, { ...order, payment_status: 'confirmed', acknowledged: true })
      return next
    })

    apiConfirmPayment(orderId).catch(err => {
      setError(extractErrorMessage(err))
      fetchOrders()
    })
    // Auto-acknowledge in DB so other devices know this order is seen
    apiAcknowledgeOrder(orderId).catch(() => {})
  }

  // ── DB-backed acknowledgement ───────────────────
  // Stored in DB → persists across all staff devices/tabs
  function handleAcknowledge(orderId) {
    // Optimistic update
    setOrdersMap(prev => {
      const next = new Map(prev)
      const order = next.get(orderId)
      if (order) next.set(orderId, { ...order, acknowledged: true })
      return next
    })

    apiAcknowledgeOrder(orderId).catch(err => {
      setError(extractErrorMessage(err))
      fetchOrders() // rollback on error
    })
  }

  function handleAcknowledgeAll() {
    ordersMap.forEach((order) => {
      if (order.status === 'received' && !order.acknowledged) {
        handleAcknowledge(order.id)
      }
    })
  }

  // ── Item availability toggle ────────────────────
  function handleToggleAvailability(itemId) {
    // Optimistic update
    setMenuItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, is_available: item.is_available === false ? true : false }
          : item
      )
    )

    apiToggleAvailability(itemId)
      .then(data => {
        // Sync with server-confirmed value
        setMenuItems(prev =>
          prev.map(item =>
            item.id === itemId ? { ...item, is_available: data.is_available } : item
          )
        )
      })
      .catch(err => {
        setError(extractErrorMessage(err))
        fetchMenuItems() // rollback
      })
  }

  // ── Cancel order ────────────────────────────────
  function handleCancelOrder(orderId) {
    if (!window.confirm('Are you sure you want to cancel this order?')) return

    // Optimistic update
    setOrdersMap(prev => {
      const next = new Map(prev)
      const order = next.get(orderId)
      if (order) next.set(orderId, { ...order, status: 'cancelled' })
      return next
    })

    apiCancelOrder(orderId).catch(err => {
      setError(extractErrorMessage(err))
      fetchOrders()
    })
  }

  function handleLogout() {
    localStorage.removeItem('dashboardAccess')
    localStorage.removeItem('dashboardExpiry')
    localStorage.removeItem('dashboardApiKey')
    window.location.reload()
  }

  // ── Filter orders by tab ────────────────────────
  const allOrders = Array.from(ordersMap.values()).sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at)
  })

  function getFilteredOrders() {
    switch (activeTab) {
      case 'Active':
        return allOrders.filter(o =>
          (o.status === 'received' || o.status === 'preparing') ||
          (o.payment_status === 'pending')
        )
      case 'Ready':
        return allOrders.filter(o => o.status === 'ready')
      case 'All Today':
      default:
        return allOrders
    }
  }

  const filteredOrders = getFilteredOrders()

  // ── Count unacknowledged (uses DB field) ────────
  let unackedCount = 0
  ordersMap.forEach(order => {
    if (order.status === 'received' && !order.acknowledged) {
      unackedCount++
    }
  })

  // ── Status helpers ──────────────────────────────
  function getStatusBadge(status) {
    if (status === 'received') return '⏳ Received'
    if (status === 'preparing') return '👨‍🍳 Preparing'
    if (status === 'ready') return '✅ Ready'
    if (status === 'cancelled') return '❌ Cancelled'
    return status
  }

  function getStatusClass(status) {
    if (status === 'preparing') return 'preparing'
    if (status === 'ready') return 'ready'
    if (status === 'cancelled') return 'cancelled'
    return ''
  }

  function formatTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  // ── Render ──────────────────────────────────────
  return (
    <div>
      <div className="dashboard-header">
        <div className="dashboard-header-row">
          <div>
            <h1>📋 Staff Dashboard</h1>
            <p>Live orders — updates automatically</p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
        <div className="dashboard-header-actions">
          <button onClick={unlockAudio} className="enable-sound-btn">
            🔔 Enable Sound
          </button>
          {unackedCount > 0 && (
            <button onClick={handleAcknowledgeAll} className="ack-all-btn">
              ✓ Dismiss All ({unackedCount})
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="dashboard-error">
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="dashboard-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'Active' && (
              <span className="tab-count">
                {allOrders.filter(o =>
                  (o.status === 'received' || o.status === 'preparing') ||
                  (o.payment_status === 'pending')
                ).length}
              </span>
            )}
            {tab === 'Ready' && (
              <span className="tab-count">
                {allOrders.filter(o => o.status === 'ready').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Menu Management Tab ── */}
      {activeTab === 'Menu' && (
        <div className="menu-management">
          <div className="menu-management-header">
            <h2>Menu Items</h2>
            <p>Toggle items to mark them as sold out in real time</p>
          </div>

          {menuLoading && (
            <div className="menu-mgmt-loading">Loading menu…</div>
          )}

          {!menuLoading && menuItems.length === 0 && (
            <div className="no-orders">
              <p>No menu items found</p>
            </div>
          )}

          {!menuLoading && menuItems.length > 0 && (
            <div className="menu-mgmt-grid">
              {menuItems.map(item => {
                const isAvail = item.is_available !== false
                return (
                  <div
                    key={item.id}
                    className={`menu-mgmt-card ${isAvail ? '' : 'menu-mgmt-unavailable'}`}
                  >
                    <div className="menu-mgmt-info">
                      <span className="menu-mgmt-name">{item.name}</span>
                      {item.category && (
                        <span className="menu-mgmt-category">{item.category}</span>
                      )}
                      <span className="menu-mgmt-price">₹{item.price / 100}</span>
                    </div>
                    <button
                      className={`menu-mgmt-toggle ${isAvail ? 'toggle-available' : 'toggle-soldout'}`}
                      onClick={() => handleToggleAvailability(item.id)}
                    >
                      {isAvail ? '✅ Available' : '❌ Sold Out'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Orders list (Active / Ready / All Today) ── */}
      {activeTab !== 'Menu' && (
        <div className="orders-list">
          {filteredOrders.length === 0 && (
            <div className="no-orders">
              <p>No {activeTab.toLowerCase()} orders</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                {activeTab === 'Active'
                  ? 'New orders will appear here automatically'
                  : 'No orders in this category'}
              </p>
            </div>
          )}

          {filteredOrders.map(order => {
            // Uses order.acknowledged from DB — syncs across devices
            const isUnacked = order.status === 'received' && !order.acknowledged

            return (
              <div
                key={order.id}
                className={`order-card ${getStatusClass(order.status)} ${isUnacked ? 'order-new' : ''}`}
              >
                {/* Header row */}
                <div className="order-card-header">
                  <div>
                    <span className="order-number">#{order.id}</span>
                    <span className="order-time">{formatTime(order.created_at)}</span>
                  </div>
                  {isUnacked && (
                    <button
                      className="ack-btn"
                      onClick={() => handleAcknowledge(order.id)}
                    >
                      ✓ Acknowledge
                    </button>
                  )}
                </div>

                <div className="order-name">👤 {order.customer_name}</div>
                <div className="order-phone">📞 {order.customer_phone}</div>

                {/* Order items */}
                {order.items && order.items.length > 0 && (
                  <div className="order-items-list">
                    {order.items.map((item, idx) => (
                      <span key={idx} className="order-item-tag">
                        {item.quantity}× {item.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="order-total">₹{order.total_amount / 100}</div>

                {/* Payment status */}
                {order.payment_status === 'pending' && (
                  <div className="payment-pending-banner">
                    ⚠️ {order.payment_method === 'upi' ? 'UPI Payment Pending' : 'Cash Payment Pending'} —
                    verify ₹{order.total_amount / 100} before confirming
                    <button
                      className="confirm-payment-btn"
                      onClick={() => handleConfirmPayment(order.id)}
                    >
                      ✅ Confirm Payment Received
                    </button>
                  </div>
                )}

                {order.payment_status === 'confirmed' && (
                  <div className="payment-confirmed-badge">
                    💰 Payment Confirmed
                    {order.payment_method === 'upi' && ' (UPI)'}
                    {order.payment_method === 'cash' && ' (Cash)'}
                  </div>
                )}

                {/* Status badge */}
                <div className={`order-status ${getStatusClass(order.status)}`}>
                  {getStatusBadge(order.status)}
                </div>

                {/* Action buttons */}
                {order.status === 'received' && (
                  <button
                    className="ready-btn"
                    onClick={() => handleUpdateStatus(order.id, 'preparing')}
                  >
                    👨‍🍳 Start Preparing
                  </button>
                )}

                {order.status === 'preparing' && (
                  <button
                    className="ready-btn"
                    onClick={() => handleUpdateStatus(order.id, 'ready')}
                  >
                    ✅ Mark Ready
                  </button>
                )}

                {order.status === 'ready' && (
                  <button className="ready-btn" disabled>
                    Done
                  </button>
                )}

                {/* Cancel button for received orders */}
                {order.status === 'received' && (
                  <button
                    className="cancel-order-btn"
                    onClick={() => handleCancelOrder(order.id)}
                  >
                    ❌ Cancel Order
                  </button>
                )}

                {order.status === 'cancelled' && (
                  <button className="ready-btn" disabled style={{ opacity: 0.5 }}>
                    Cancelled
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Dashboard