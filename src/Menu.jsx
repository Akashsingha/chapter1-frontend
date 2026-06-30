import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Menu.css";

function Menu({ cart, addToCart }) {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    axios.get("https://chapter1-backend-1.onrender.com/menu").then((response) => {
      setMenuItems(response.data);
    });
  }, []);

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  // Group items by category
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
                <button className="add-btn" onClick={() => addToCart(item)}>
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Menu;
