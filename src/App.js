import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Menu from './Menu'
import Cart from './Cart'
import Dashboard from './Dashboard'
import Confirmed from './Confirmed'
import Payment from './Payment'
import DashboardLogin from './DashboardLogin'

function ProtectedDashboard() {
  const [hasAccess, setHasAccess] = useState(
    sessionStorage.getItem('dashboardAccess') === 'true'
  )

  if (hasAccess) {
    return <Dashboard />
  }
  return <DashboardLogin onSuccess={() => setHasAccess(true)} />
}

function App() {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('cart')
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      // Corrupt localStorage — start fresh
      localStorage.removeItem('cart')
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart))
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }, [cart])

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  function removeFromCart(itemId) {
    setCart(prev => prev.filter(i => i.id !== itemId))
  }

  function decreaseQuantity(itemId) {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) {
        return prev.filter(i => i.id !== itemId)
      }
      return prev.map(i =>
        i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
      )
    })
  }

  function clearCart() {
    setCart([])
    try {
      localStorage.removeItem('cart')
    } catch {
      // silently ignore
    }
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Menu cart={cart} addToCart={addToCart} />} />
        <Route path="/cart" element={
          <Cart
            cart={cart}
            removeFromCart={removeFromCart}
            decreaseQuantity={decreaseQuantity}
            addToCart={addToCart}
            clearCart={clearCart}
          />}
        />
        <Route path="/payment/:orderId" element={<Payment />} />
        <Route path="/confirmed/:orderId" element={<Confirmed />} />
        {/* Redirect old /confirmed route to menu */}
        <Route path="/confirmed" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<ProtectedDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App