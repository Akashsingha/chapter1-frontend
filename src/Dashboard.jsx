import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import supabase from './supabaseClient'
import './Dashboard.css'

function Dashboard() {
  const [orders, setOrders] = useState([])
  const audioCtx = useRef(null)
  const bellInterval = useRef(null)

  // eslint-disable-next-line no-use-before-define
  function playBell() {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtx.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1);
  }

  function startRinging() {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    audioCtx.current.resume().then(() => {
      playBell()
      bellInterval.current = setInterval(() => {
        playBell()
      }, 2000)
    })
  }

  function stopRinging() {
    if (bellInterval.current) {
      clearInterval(bellInterval.current)
      bellInterval.current = null
    }
  }

  // eslint-disable-next-line no-use-before-define
  function unlockAudio() {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    audioCtx.current.resume()
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders(prev => [payload.new, ...prev])
          startRinging()
        }
      )
      .subscribe()

    fetchOrders()

    return () => supabase.removeChannel(channel)
  }, [])

  function fetchOrders() {
    axios.get('https://chapter1-backend-1.onrender.com/orders')
      .then(response => setOrders(response.data.reverse()))
  }

  function updateStatus(orderId, status) {
    stopRinging()
    axios.patch(`https://chapter1-backend-1.onrender.com/orders/${orderId}/status`, {
      status: status
    }).then(() => {
      setOrders(prev => prev.map(o =>
        o.id === orderId ? {...o, status: status} : o
      ))
    })
  }

  function confirmPayment(orderId) {
    axios.patch(`https://chapter1-backend-1.onrender.com/orders/${orderId}/payment`, {
      payment_status: 'confirmed'
    }).then(() => {
      setOrders(prev => prev.map(o =>
        o.id === orderId ? {...o, payment_status: 'confirmed'} : o
      ))
    })
  }

  function getStatusBadge(status) {
    if (status === 'received') return '⏳ Received'
    if (status === 'preparing') return '👨‍🍳 Preparing'
    if (status === 'ready') return '✅ Ready'
    return status
  }

  function getStatusClass(status) {
    if (status === 'preparing') return 'preparing'
    if (status === 'ready') return 'ready'
    return ''
  }

  return (
    <div>
      <div className="dashboard-header">
        <h1>📋 Receptionist Dashboard</h1>
        <p>Live orders — updates automatically</p>
        <button
          onClick={unlockAudio}
          style={{
            marginTop: "10px",
            background: "#c8951a",
            border: "none",
            color: "white",
            padding: "8px 16px",
            borderRadius: "20px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          🔔 Enable Sound
        </button>
      </div>

      <div className="orders-list">
        {orders.length === 0 && (
          <div className="no-orders">
            <p>No orders yet</p>
            <p style={{ fontSize: "13px", marginTop: "8px" }}>
              New orders will appear here automatically
            </p>
          </div>
        )}

        {orders.map((order, index) => (
          <div
            key={index}
            className={`order-card ${getStatusClass(order.status)}`}
          >
            <div className="order-name">👤 {order.customer_name}</div>
            <div className="order-phone">📞 {order.customer_phone}</div>
            <div className="order-total">₹{order.total_amount / 100}</div>

            {order.payment_status === 'pending' && (
              <div className="payment-pending-banner">
                ⚠️ {order.payment_method === 'upi' ? 'UPI Payment Pending' : 'Cash Payment Pending'} — 
                verify ₹{order.total_amount/100} before confirming
                <button className="confirm-payment-btn" onClick={() => confirmPayment(order.id)}>
                  ✅ Confirm Payment Received
                </button>
              </div>
            )}

            {order.payment_status === 'confirmed' && (
              <div className="payment-confirmed-badge">
                💰 Payment Confirmed
              </div>
            )}

            <div className={`order-status ${getStatusClass(order.status)}`}>
              {getStatusBadge(order.status)}
            </div>

            {order.status === "received" && (
              <button
                className="ready-btn"
                onClick={() => updateStatus(order.id, "preparing")}
              >
                👨‍🍳 Start Preparing
              </button>
            )}

            {order.status === "preparing" && (
              <button
                className="ready-btn"
                onClick={() => updateStatus(order.id, "ready")}
              >
                ✅ Mark Ready
              </button>
            )}

            {order.status === "ready" && (
              <button className="ready-btn" disabled>
                Done
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard