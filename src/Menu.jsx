import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMenu } from "./api";
import "./Menu.css";

function Menu({ cart, addToCart }) {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [addedItem, setAddedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMenu = useCallback(() => {
    setLoading(true);
    setError("");
    getMenu()
      .then((data) => {
        setMenuItems(data);
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

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  function handleAdd(item) {
    addToCart(item);
    setAddedItem(item.id);
    setTimeout(() => setAddedItem(null), 1000);
  }

  const grouped = menuItems.reduce((acc, item) => {
    const category = item.category || "Others";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  return (
    <div>
      <div className="menu-header">
        <h1>☕ Chapter 1</h1>
        <button className="cart-btn" onClick={() => navigate("/cart")}>
          🛒 {totalItems} items
        </button>
      </div>

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
