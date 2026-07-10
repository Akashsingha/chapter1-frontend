import { useState } from 'react'
import './Login.css'
import axios from 'axios'

function DashboardLogin({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleLogin() {
    axios.post('https://chapter1-backend-1.onrender.com/verify-dashboard-password', {
      password: password
    }).then(response => {
      if (response.data.valid) {
        sessionStorage.setItem('dashboardAccess', 'true')
        onSuccess()
      } else {
        setError('Incorrect password')
      }
    }).catch(() => {
      setError('Incorrect password')
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