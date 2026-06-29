import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Menu.css";

// inside Menu function:

// inside return, below cart counter:

function Menu({ cart, addToCart }) {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    axios.get("https://chapter1-backend-1.onrender.com/menu").then((response) => {
      setMenuItems(response.data);
    });
  }, []);
  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
  return (
    <div>
      <div className="menu-header"></div>
      <h1>☕ Chapter 1</h1>
      <button className="cart-btn" onClick={() => navigate("/cart")}>
        🛒 {totalItems} items
      </button>
      <div className="menu-grid">
        {menuItems.map((item) => (
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
  );
}

export default Menu;
