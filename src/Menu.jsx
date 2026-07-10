import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Menu.css";

function Menu({ cart, addToCart }) {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [addedItem, setAddedItem] = useState(null);

  useEffect(() => {
    axios
      .get("https://chapter1-backend-1.onrender.com/menu")
      .then((response) => {
        setMenuItems(response.data);
      });
  }, []);

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

      {Object.keys(grouped).map((category) => (
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
