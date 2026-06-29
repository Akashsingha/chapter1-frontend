import { useLocation, useNavigate } from 'react-router-dom'
import './Confirmed.css'

function Confirmed() {
  const location = useLocation()
  const navigate = useNavigate()
  const { name, total } = location.state || {}

  return (
    <div className="confirmed-container">
      <div className="confirmed-card">
        <div className="confirmed-icon">✅</div>
        <h1>Order Placed!</h1>
        <p className="confirmed-name">Thank you, {name}!</p>
        <p className="confirmed-message">
          Your order has been received by the cafe. 
          Please pay <strong>₹{total / 100}</strong> at the counter.
        </p>

        <div className="confirmed-status">
          <div className="status-step active">
            <span>📋</span>
            <p>Order Received</p>
          </div>
          <div className="status-divider" />
          <div className="status-step">
            <span>👨‍🍳</span>
            <p>Preparing</p>
          </div>
          <div className="status-divider" />
          <div className="status-step">
            <span>🔔</span>
            <p>Ready</p>
          </div>
        </div>

        <p className="confirmed-note">
          We'll let you know when your order is ready!
        </p>

        <button className="back-home-btn" onClick={() => navigate('/')}>
          ← Back to Menu
        </button>
      </div>
    </div>
  )
}

export default Confirmed