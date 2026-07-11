import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createOrder, extractErrorMessage } from "./api";
import "./Cart.css";

function Cart({ cart, removeFromCart, decreaseQuantity, addToCart, clearCart }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [payment, setPayment] = useState("cash");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [phoneError, setPhoneError] = useState(false);
  const [shake, setShake] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const orderLock = useRef(false); // Fix #6 — synchronous lock prevents double-tap

  function placeOrder() {
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!name.trim() || !phoneRegex.test(phone)) {
      setPhoneError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    // Fix #6 — synchronous check (state updates are async and can miss fast taps)
    if (orderLock.current) return;
    orderLock.current = true;

    setPhoneError(false);
    setError("");
    setOrdering(true);

    // Generate idempotency key to prevent server-side duplicates too
    const idempotencyKey = `${phone}-${Date.now()}`;

    createOrder({
      customer_name: name,
      customer_phone: phone,
      items: cart,
      payment_method: payment,
      idempotency_key: idempotencyKey,
    })
      .then((order) => {
        // Save to localStorage so the menu page can show a live tracking banner
        try {
          localStorage.setItem('activeOrder', JSON.stringify({
            id: order.id,
            placedAt: Date.now(),
            total: order.total_amount,
            paymentMethod: order.payment_method,
          }))
        } catch {
          // localStorage full or unavailable — tracking just won't show, order still placed
        }
        clearCart()
        if (payment === "upi") {
          navigate(`/payment/${order.id}`);
        } else {
          navigate(`/confirmed/${order.id}`);
        }
      })
      .catch((err) => {
        orderLock.current = false; // unlock on error so user can retry
        setOrdering(false);
        setError(extractErrorMessage(err));
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
                onClick={() => decreaseQuantity(item.id)}
              >
                −
              </button>
              <span className="qty-num">{item.quantity}</span>
              <button className="qty-btn" onClick={() => addToCart(item)}>
                +
              </button>
              <button
                className="remove-btn"
                onClick={() => removeFromCart(item.id)}
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

        {error && (
          <div className="order-error-banner">
            <p>⚠️ {error}</p>
          </div>
        )}

        <button className="order-btn" onClick={placeOrder} disabled={ordering}>
          {ordering
            ? "Placing..."
            : `✅ Place Order — ${payment === "cash" ? "Cash" : "UPI"}`}
        </button>
      </div>
    </div>
  );
}

export default Cart;