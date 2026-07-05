import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Cart.css";

function Cart({ cart, removeFromCart, decreaseQuantity, addToCart }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [payment, setPayment] = useState("cash");
  const navigate = useNavigate();
  const [phoneError, setPhoneError] = useState(false);
  const [shake, setShake] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function generateUpiLink() {
    const upiId = "7866835502@slc";
    const payeeName = "Chapter 1 Cafe";
    const amount = (total / 100).toFixed(2);
    const note = `Order`;
    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${note}`;
  }

  function placeOrder() {
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!name.trim() || !phoneRegex.test(phone)) {
      setPhoneError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setPhoneError(false);
    setOrdering(true);

    axios.post('https://chapter1-backend-1.onrender.com/orders', {
      customer_name: name,
      customer_phone: phone,
      items: cart,
      payment_method: payment
    })
    .then(response => {
      setOrdering(false);
      if (payment === 'upi') {
        window.location.href = generateUpiLink();
        setTimeout(() => {
          navigate('/confirmed', { state: {
            name: name,
            total: response.data.total,
            payment: 'upi'
          }});
        }, 1500);
      } else {
        navigate('/confirmed', { state: {
          name: name,
          total: response.data.total,
          payment: 'cash'
        }});
      }
    });
  }

  if (cart.length === 0) {
    return (
      <div>
        <div className="cart-header">
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              color: "#fdf6ec",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <h1>Your Cart</h1>
        </div>
        <div className="empty-cart">
          <p>🛒 Your cart is empty</p>
          <p style={{ marginTop: "10px", fontSize: "14px" }}>
            Go back and add some items
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="cart-header">
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            color: "#fdf6ec",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <h1>Your Cart</h1>
      </div>

      <div className="cart-items">
        {cart.map((item) => (
          <div key={item.id} className="cart-item">
            <div>
              <div className="cart-item-name">{item.name}</div>
              <div className="cart-item-price">
                ₹{(item.price * item.quantity) / 100}
              </div>
            </div>
            <div className="qty-controls">
              <button
                className="qty-btn"
                onClick={() => decreaseQuantity(item.name)}
              >
                −
              </button>
              <span className="qty-num">{item.quantity}</span>
              <button className="qty-btn" onClick={() => addToCart(item)}>
                +
              </button>
              <button
                className="remove-btn"
                onClick={() => removeFromCart(item.name)}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-total">
        <span>Total</span>
        <span>₹{total / 100}</span>
      </div>

      <div className="payment-section">
        <h3>Payment Method</h3>
        <div className="payment-options">
          <div
            className={`payment-option ${payment === "cash" ? "selected" : ""}`}
            onClick={() => setPayment("cash")}
          >
            <span className="payment-icon">💵</span>
            <span className="payment-label">Cash</span>
            <span className="payment-sub">Pay at counter</span>
          </div>

          <div
            className={`payment-option ${payment === "upi" ? "selected" : ""}`}
            onClick={() => setPayment("upi")}
          >
            <span className="payment-icon">📱</span>
            <span className="payment-label">Online Payment</span>
          </div>

          <div className="payment-option disabled">
            <span className="payment-icon">💳</span>
            <span className="payment-label">Card</span>
            <span className="coming-soon">Coming Soon</span>
          </div>
        </div>
      </div>

      <div className="cart-form">
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className={shake ? "shake" : ""}>
          <input
            placeholder="Phone number"
            value={phone}
            maxLength={10}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              setPhone(value);
              setPhoneError(false);
            }}
          />
          {phoneError && (
            <p className="error-text">
              Please enter a valid 10-digit phone number
            </p>
          )}
        </div>
        <button className="order-btn" onClick={placeOrder} disabled={ordering}>
          {ordering ? "Placing..." : `✅ Place Order — ${payment === 'cash' ? 'Cash' : 'UPI'}`}
        </button>
      </div>
    </div>
  );
}

export default Cart;