import { useState } from 'react'
import './Login.css'
import { verifyDashboardPassword, extractErrorMessage } from './api'

function DashboardLogin({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleLogin() {
    verifyDashboardPassword(password)
      .then(data => {
        if (data.valid) {
          sessionStorage.setItem('dashboardAccess', 'true')
          onSuccess()
        } else {
          setError('Incorrect password')
        }
      })
      .catch(err => {
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
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        {error && <p className="login-error">{error}</p>}
        <button className="login-btn" onClick={handleLogin}>
          Enter Dashboard
        </button>
      </div>
    </div>
  )
}

export default DashboardLogin