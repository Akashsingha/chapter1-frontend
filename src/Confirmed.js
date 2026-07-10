import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getOrder, extractErrorMessage } from './api'
import supabase from './supabaseClient'
import './Confirmed.css'

function Confirmed() {
  const { orderId } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchOrder = useCallback(() => {
    setLoading(true)
    setError('')
    getOrder(orderId)
      .then(data => {
        // If UPI order with pending payment, redirect to payment page
        if (data.payment_method === 'upi' && data.payment_status === 'pending') {
          navigate(`/payment/${orderId}`, { replace: true })
          return
        }
        setOrder(data)
        setLoading(false)
      })
      .catch(err => {
        setError(extractErrorMessage(err))
        setLoading(false)
      })
  }, [orderId, navigate])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  // Subscribe to live status updates
  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`confirmed-${orderId}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder(prev => prev ? { ...prev, ...payload.new } : payload.new)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [orderId])

  function getActiveStep(status) {
    if (status === 'ready') return 3
    if (status === 'preparing') return 2
    return 1 // received
  }

  if (loading) {
    return (
      <div className="confirmed-container">
        <div className="confirmed-card">
          <div className="confirmed-loading">
            <div className="confirmed-spinner" />
            <p>Loading order…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="confirmed-container">
        <div className="confirmed-card">
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</p>
          <p style={{ color: '#888', marginBottom: '20px' }}>{error}</p>
          <button className="back-home-btn" onClick={fetchOrder}>
            🔄 Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!order) return null

  const activeStep = getActiveStep(order.status)
  const isCash = order.payment_method === 'cash'
  const isUpiConfirmed = order.payment_method === 'upi' && order.payment_status === 'confirmed'
  const amount = (order.total_amount / 100).toFixed(2)

  return (
    <div className="confirmed-container">
      <div className="confirmed-card">
        <div className="confirmed-icon">
          {isUpiConfirmed ? '✅' : '📋'}
        </div>

        <h1>
          {isUpiConfirmed
            ? 'Payment Confirmed!'
            : 'Order Placed!'}
        </h1>

        <p className="confirmed-name">
          {order.customer_name ? `Thank you, ${order.customer_name}!` : 'Thank you!'}
        </p>

        {isCash && (
          <p className="confirmed-message">
            Your order has been received. Please pay{' '}
            <strong>₹{amount}</strong> at the counter.
            <br />
            <span className="confirmed-order-ref">Order #{order.id}</span>
          </p>
        )}

        {isUpiConfirmed && (
          <p className="confirmed-message">
            Payment of <strong>₹{amount}</strong> confirmed.
            Your order is being prepared!
          </p>
        )}

        {/* Order items */}
        {order.items && order.items.length > 0 && (
          <div className="confirmed-items">
            {order.items.map((item, idx) => (
              <div key={idx} className="confirmed-item-row">
                <span>{item.quantity}× {item.name}</span>
                <span>₹{(item.price * item.quantity) / 100}</span>
              </div>
            ))}
          </div>
        )}

        {/* Status tracker */}
        <div className="confirmed-status">
          <div className={`status-step ${activeStep >= 1 ? 'active' : ''}`}>
            <span>📋</span>
            <p>Received</p>
          </div>
          <div className={`status-divider ${activeStep >= 2 ? 'active-divider' : ''}`} />
          <div className={`status-step ${activeStep >= 2 ? 'active' : ''}`}>
            <span>👨‍🍳</span>
            <p>Preparing</p>
          </div>
          <div className={`status-divider ${activeStep >= 3 ? 'active-divider' : ''}`} />
          <div className={`status-step ${activeStep >= 3 ? 'active' : ''}`}>
            <span>🔔</span>
            <p>Ready</p>
          </div>
        </div>

        {activeStep < 3 && (
          <p className="confirmed-note">
            We'll let you know when your order is ready!
          </p>
        )}

        {activeStep === 3 && (
          <p className="confirmed-note confirmed-ready-note">
            🎉 Your order is ready! Pick it up at the counter.
          </p>
        )}

        <button className="back-home-btn" onClick={() => navigate('/')}>
          ← Back to Menu
        </button>
      </div>
    </div>
  )
}

export default Confirmed