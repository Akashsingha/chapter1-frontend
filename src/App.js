import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Menu from './Menu'
import Cart from './Cart'
import Dashboard from './Dashboard'
import Confirmed from './Confirmed'
import Payment from './Payment'
import DashboardLogin from './DashboardLogin'

// Fix #20 — Use localStorage so staff don't have to re-login every tab
function ProtectedDashboard() {
  const [hasAccess, setHasAccess] = useState(
    localStorage.getItem('dashboardAccess') === 'true'
  )

  if (hasAccess) {
    return <Dashboard />
  }
  return <DashboardLogin onSuccess={() => {
    localStorage.setItem('dashboardAccess', 'true')
    setHasAccess(true)
  }} />
}

// Fix #17 — Friendly 404 page
function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#fdf6ec',
    }}>
      <p style={{ fontSize: '64px', marginBottom: '8px' }}>☕</p>
      <h1 style={{ fontSize: '24px', color: '#3b2a1a', marginBottom: '8px' }}>
        Page Not Found
      </h1>
      <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>
        Looks like this page doesn't exist.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          background: '#3b2a1a',
          color: '#fdf6ec',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        ← Back to Menu
      </button>
    </div>
  )
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

  // Fix #15 — Sync cart prices when menu loads with fresh data
  const syncCartPrices = useCallback((menuItems) => {
    if (!menuItems || menuItems.length === 0) return
    setCart(prev => {
      if (prev.length === 0) return prev
      let changed = false
      const updated = prev.map(cartItem => {
        const menuItem = menuItems.find(m => m.id === cartItem.id)
        if (menuItem && menuItem.price !== cartItem.price) {
          changed = true
          return { ...cartItem, price: menuItem.price }
        }
        // Remove items that no longer exist in menu
        if (!menuItem) {
          changed = true
          return null
        }
        return cartItem
      }).filter(Boolean)
      return changed ? updated : prev
    })
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <Menu cart={cart} addToCart={addToCart} syncCartPrices={syncCartPrices} />
        } />
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
        {/* Fix #17 — catch-all 404 route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App