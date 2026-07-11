import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMenu, getOrder } from "./api";
import supabase from "./supabaseClient";
import "./Menu.css";
import logo from "./logo.jpg";

function Menu({ cart, addToCart, syncCartPrices }) {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [addedItem, setAddedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Active order tracking ────────────────────────
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);

  const fetchMenu = useCallback(() => {
    setLoading(true);
    setError("");
    getMenu()
      .then((data) => {
        setMenuItems(data);
        // Fix #15 — sync stale cart prices with fresh menu prices
        if (syncCartPrices) syncCartPrices(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err.code === "ECONNABORTED"
            ? "Server is starting up. This can take up to 30 seconds — please retry."
            : "Could not load menu. Please check your connection."
        );
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // ── Check localStorage for an active order ───────
  useEffect(() => {
    const stored = localStorage.getItem("activeOrder");
    if (!stored) return;

    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      localStorage.removeItem("activeOrder");
      return;
    }

    // Only show if the order was placed today
    const today = new Date().toDateString();
    const orderDate = new Date(parsed.placedAt).toDateString();
    if (today !== orderDate) {
      localStorage.removeItem("activeOrder");
      return;
    }

    // Fetch the current status from the server
    getOrder(parsed.id)
      .then((order) => {
        if (order.status === "cancelled" || order.status === "completed") {
          // Order was cancelled or picked up — no point tracking it
          localStorage.removeItem("activeOrder");
          return;
        }
        setActiveOrder(parsed);
        setOrderStatus(order.status);
      })
      .catch(() => {
        // Order ID not found in DB — clear stale entry
        localStorage.removeItem("activeOrder");
      });
  }, []);

  // ── Live status updates via Supabase realtime ────
  // When kitchen marks order ready, banner lights up green instantly
  useEffect(() => {
    if (!activeOrder) return;

    const channel = supabase
      .channel(`menu-track-${activeOrder.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${activeOrder.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          
          if (newStatus === "ready" && orderStatus !== "ready") {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.type = "sine";
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              gain.gain.setValueAtTime(0.5, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.5);
            } catch (e) { /* ignore */ }
          }
          
          setOrderStatus(newStatus);
          if (newStatus === "cancelled" || newStatus === "completed") {
            localStorage.removeItem("activeOrder");
            setActiveOrder(null);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeOrder]);

  function dismissActiveOrder() {
    localStorage.removeItem("activeOrder");
    setActiveOrder(null);
    setOrderStatus(null);
  }

  // ── Menu helpers ─────────────────────────────────
  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  function handleAdd(item) {
    addToCart(item);
    setAddedItem(item.id);
    setTimeout(() => setAddedItem(null), 1000);
  }

  const grouped = menuItems
    .filter(item => item.is_available !== false) // hide sold-out items from customers
    .reduce((acc, item) => {
      const category = item.category || "Others";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});

  // ── Status helpers for banner ────────────────────
  function getBannerIcon() {
    if (orderStatus === "ready") return "🔔";
    if (orderStatus === "preparing") return "👨‍🍳";
    return "📋";
  }

  function getBannerTitle() {
    if (orderStatus === "ready") return "Your order is ready!";
    if (orderStatus === "preparing") return "Being prepared...";
    return "Order received";
  }

  function getBannerSub() {
    if (orderStatus === "ready") return "Come collect it at the counter 🎉";
    if (orderStatus === "preparing") return "The kitchen is working on it";
    return "Waiting for the kitchen to start";
  }

  return (
    <div>
      <div className="menu-header">
        <div className="menu-header-brand">
          <img src={logo} alt="Chapter 1 Logo" className="menu-logo" />
          <h1>Chapter 1</h1>
        </div>
        <button className="cart-btn" onClick={() => navigate("/cart")}>
          🛒 {totalItems} items
        </button>
      </div>

      {/* ── Active Order Tracking Banner ── */}
      {activeOrder && (
        <div
          className={`active-order-banner ${orderStatus === "ready" ? "banner-ready" : ""}`}
          onClick={() => navigate(`/confirmed/${activeOrder.id}`)}
          role="button"
        >
          <div className="banner-left">
            <span className={`banner-icon ${orderStatus === "ready" ? "banner-icon-pulse" : ""}`}>
              {getBannerIcon()}
            </span>
            <div className="banner-text">
              <span className="banner-title">{getBannerTitle()}</span>
              <span className="banner-sub">{getBannerSub()}</span>
            </div>
          </div>
          <div className="banner-right">
            <span className="banner-track">Track →</span>
            <button
              className="banner-dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismissActiveOrder();
              }}
              aria-label="Dismiss order tracker"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="menu-loading">
          <div className="menu-skeleton">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton-card">
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-price" />
                <div className="skeleton-line skeleton-btn" />
              </div>
            ))}
          </div>
          <p className="loading-text">Loading menu…</p>
        </div>
      )}

      {!loading && error && (
        <div className="menu-error">
          <p className="error-icon">☕</p>
          <p className="error-message">{error}</p>
          <button className="retry-btn" onClick={fetchMenu}>
            🔄 Try Again
          </button>
        </div>
      )}

      {!loading && !error && menuItems.length === 0 && (
        <div className="menu-error">
          <p className="error-message">No menu items available right now.</p>
          <button className="retry-btn" onClick={fetchMenu}>
            🔄 Refresh
          </button>
        </div>
      )}

      {!loading &&
        !error &&
        Object.keys(grouped).map((category) => (
          <div key={category} className="menu-section">
            <h2 className="section-title">{category}</h2>
            <div className="menu-grid">
              {grouped[category].map((item) => (
                <div key={item.id} className="menu-card">
                  <h3>{item.name}</h3>
                  <p>₹{item.price / 100}</p>
                  <button
                    className={`add-btn ${addedItem === item.id ? "added" : ""}`}
                    onClick={() => handleAdd(item)}
                  >
                    {addedItem === item.id ? "✓ Added" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

      {totalItems > 0 && (
        <div className="floating-cart" onClick={() => navigate("/cart")}>
          <span className="floating-cart-count">{totalItems} items</span>
          <span className="floating-cart-text">View Cart →</span>
        </div>
      )}
    </div>
  );
}

export default Menu;
