import { useState } from 'react'
import './Login.css'
import { verifyDashboardPassword, extractErrorMessage } from './api'

function DashboardLogin({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false) // Fix #19 — loading state

  function handleLogin() {
    if (!password.trim()) {
      setError('Please enter a password')
      return
    }

    setLoading(true)
    setError('')

    verifyDashboardPassword(password)
      .then(data => {
        setLoading(false)
        if (data.valid) {
          // Fix #3 — Store API key for future authenticated requests
          if (data.api_key) {
            localStorage.setItem('dashboardApiKey', data.api_key)
          }
          sessionStorage.setItem('dashboardAccess', 'true')
          onSuccess()
        } else {
          setError('Incorrect password')
        }
      })
      .catch(err => {
        setLoading(false)
        setError(extractErrorMessage(err))
      })
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🔒 Staff Access</h1>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleLogin()}
          disabled={loading}
        />
        {error && <p className="login-error">{error}</p>}
        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? 'Logging in...' : 'Enter Dashboard'}
        </button>
      </div>
    </div>
  )
}

export default DashboardLogin