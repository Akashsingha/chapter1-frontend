import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { getOrder, getUpiString, openUpiLink, extractErrorMessage } from "./api";
import supabase from "./supabaseClient";
import "./Payment.css";

const POLL_INTERVAL = 5000; // 5 seconds
const EXPIRY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  // ── State machine ───────────────────────────────
  // loading | ready | redirecting | awaiting | confirmed | expired | error
  const [pageState, setPageState] = useState("loading");
  const [order, setOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const pollRef = useRef(null);
  const expiryRef = useRef(null);
  const channelRef = useRef(null);

  // ── Fetch order ─────────────────────────────────
  const fetchOrder = useCallback(() => {
    setPageState("loading");
    getOrder(orderId)
      .then((data) => {
        setOrder(data);
        if (data.payment_status === "confirmed") {
          setPageState("confirmed");
        } else {
          setPageState("ready");
        }
      })
      .catch((err) => {
        setErrorMsg(extractErrorMessage(err));
        setPageState("error");
      });
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ── Auto-redirect on confirmed ──────────────────
  useEffect(() => {
    if (pageState === "confirmed") {
      const timer = setTimeout(() => {
        navigate(`/confirmed/${orderId}`, { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [pageState, orderId, navigate]);

  // ── Polling + Supabase subscription ─────────────
  const startPolling = useCallback(() => {
    // Poll GET /orders/:id
    pollRef.current = setInterval(() => {
      getOrder(orderId)
        .then((data) => {
          setOrder(data);
          if (data.payment_status === "confirmed") {
            setPageState("confirmed");
          }
        })
        .catch(() => {
          // Silently ignore poll errors — keep trying
        });
    }, POLL_INTERVAL);

    // Supabase realtime UPDATE subscription
    channelRef.current = supabase
      .channel(`payment-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder(payload.new);
          if (payload.new.payment_status === "confirmed") {
            setPageState("confirmed");
          }
        }
      )
      .subscribe((status) => {
        // Fix #14 — auto-reconnect on channel error
        if (status === 'CHANNEL_ERROR') {
          setTimeout(() => {
            supabase.removeChannel(channelRef.current);
            startPolling(); // re-subscribe
          }, 3000);
        }
      });

    // 15-minute expiry timer
    expiryRef.current = setTimeout(() => {
      setPageState("expired");
    }, EXPIRY_TIMEOUT);
  }, [orderId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Start/stop polling when entering/leaving awaiting state
  useEffect(() => {
    if (pageState === "awaiting") {
      startPolling();
    } else {
      stopPolling();
    }
  }, [pageState, startPolling, stopPolling]);

  // ── Pay Now handler ─────────────────────────────
  function handlePayNow() {
    if (!order) return;
    setPageState("redirecting");

    // Show animation for 1.5s, then redirect to UPI app
    setTimeout(() => {
      // Fix #13 — Use anchor click instead of window.location.href
      openUpiLink(getUpiString(order));

      // After redirect attempt, move to awaiting
      // (visibilitychange will also catch this)
      setTimeout(() => {
        setPageState("awaiting");
      }, 500);
    }, 1500);
  }

  // ── "I've already paid" handler ─────────────────
  function handleIvePaid() {
    setPageState("awaiting");
  }

  // ── Retry from expired state ────────────────────
  function handleRetry() {
    setPageState("ready");
  }

  // ── Listen for app return via visibilitychange ──
  useEffect(() => {
    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        pageState === "redirecting"
      ) {
        setPageState("awaiting");
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pageState]);

  // ── Render ──────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="payment-container">
        <div className="payment-card">
          <div className="payment-loading">
            <div className="payment-spinner" />
            <p>Loading order details…</p>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="payment-container">
        <div className="payment-card">
          <div className="payment-error-state">
            <p className="error-icon-large">⚠️</p>
            <p>{errorMsg}</p>
            <button className="payment-btn" onClick={fetchOrder}>
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const upiString = order ? getUpiString(order) : "";
  const amount = order ? (order.total_amount / 100).toFixed(2) : "0.00";

  if (pageState === "confirmed") {
    return (
      <div className="payment-container">
        <div className="payment-card">
          <div className="payment-confirmed-state">
            <div className="confirmed-checkmark">✅</div>
            <h2>Payment Confirmed!</h2>
            <p>Redirecting to your order…</p>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="payment-container">
        <div className="payment-card">
          <div className="payment-expired-state">
            <p className="expired-icon">⏰</p>
            <h2>Payment Window Expired</h2>
            <p className="expired-msg">
              The 15-minute payment window has expired.
            </p>
            <button className="payment-btn" onClick={handleRetry}>
              🔄 Retry Payment
            </button>
            <div className="expired-alt">
              <p>
                Or pay <strong>₹{amount}</strong> at the counter
              </p>
              <p className="order-ref">Order #{order?.order_number || order?.id?.substring(0,4).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "redirecting") {
    return (
      <div className="payment-container">
        <div className="payment-card">
          <div className="payment-redirecting">
            <div className="qr-pulse-wrapper">
              <QRCodeSVG value={upiString} size={180} className="qr-faded" />
              <div className="scan-line" />
            </div>
            <h2>Opening your UPI app…</h2>
            <p className="redirect-sub">
              Complete the payment in your UPI app
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "awaiting") {
    return (
      <div className="payment-container">
        <div className="payment-card">
          <div className="payment-awaiting">
            <div className="awaiting-spinner" />
            <h2>Payment Pending</h2>
            <p className="awaiting-msg">
              Staff will confirm your payment shortly.
            </p>
            <div className="awaiting-order-ref">
              <p>
                Quote <strong>Order #{order?.order_number || order?.id?.substring(0,4).toUpperCase()}</strong> at the counter
              </p>
              <p className="awaiting-amount">₹{amount}</p>
            </div>
            
            <button 
              className="ive-paid-link" 
              onClick={handleRetry}
              style={{ marginTop: '20px', color: '#e53935' }}
            >
              Payment failed? Try again ↺
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready state (default) ───────────────────────
  return (
    <div className="payment-container">
      <div className="payment-card">
        <div className="payment-header-section">
          <h2>Complete Payment</h2>
          <p className="payment-order-id">Order #{order?.order_number || order?.id?.substring(0,4).toUpperCase()}</p>
        </div>

        {/* Order items summary */}
        {order?.items && order.items.length > 0 && (
          <div className="payment-items">
            {order.items.map((item, idx) => (
              <div key={idx} className="payment-item-row">
                <span>
                  {item.quantity}× {item.name}
                </span>
                <span>₹{(item.price * item.quantity) / 100}</span>
              </div>
            ))}
            <div className="payment-item-total">
              <span>Total</span>
              <span>₹{amount}</span>
            </div>
          </div>
        )}

        {!order?.items && (
          <div className="payment-amount-display">
            <p className="payment-amount-label">Amount</p>
            <p className="payment-amount-value">₹{amount}</p>
          </div>
        )}

        {/* QR Code */}
        <div className="qr-section">
          <QRCodeSVG
            value={upiString}
            size={200}
            bgColor="#ffffff"
            fgColor="#3b2a1a"
            level="M"
          />
          <p className="qr-label">Scan with any UPI app</p>
        </div>

        {/* Pay Now button */}
        <button className="pay-now-btn" onClick={handlePayNow}>
          📱 Pay Now — ₹{amount}
        </button>

        {/* I've paid link */}
        <button className="ive-paid-link" onClick={handleIvePaid}>
          I've already paid →
        </button>
      </div>
    </div>
  );
}

export default Payment;
