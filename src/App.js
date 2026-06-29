import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Menu from './Menu'
import Cart from './Cart'
import Dashboard from './Dashboard'
import Confirmed from './Confirmed'

function App() {
  const [cart, setCart] = useState([]);

  function addToCart(item) {
    const existing = cart.find((i) => i.name === item.name);
    if (existing) {
      setCart(
        cart.map((i) =>
          i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  }
  function removeFromCart(itemName) {
    setCart(cart.filter((i) => i.name !== itemName));
  }

  function decreaseQuantity(itemName) {
    const existing = cart.find((i) => i.name === itemName);
    if (existing.quantity === 1) {
      removeFromCart(itemName);
    } else {
      setCart(
        cart.map((i) =>
          i.name === itemName ? { ...i, quantity: i.quantity - 1 } : i,
        ),
      );
    }
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Menu cart={cart} addToCart={addToCart} />} />
        <Route
          path="/cart"
          element={
            <Cart
              cart={cart}
              removeFromCart={removeFromCart}
              decreaseQuantity={decreaseQuantity}
              addToCart={addToCart}
            />
          }
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/confirmed" element={<Confirmed />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App