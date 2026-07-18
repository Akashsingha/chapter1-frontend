import { useState, useEffect } from 'react'
import { getAnalytics, extractErrorMessage } from './api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import './Analytics.css'

function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(7)

  useEffect(() => {
    fetchAnalytics()
  }, [days])

  async function fetchAnalytics() {
    setLoading(true)
    setError('')
    try {
      const resp = await getAnalytics(days)
      setData(resp)
    } catch (err) {
      setError(extractErrorMessage(err))
    }
    setLoading(false)
  }

  if (loading && !data) return <div className="analytics-loading">Crunching the numbers...</div>
  if (error) return <div className="analytics-error">{error}</div>
  if (!data) return null

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2>Performance Overview</h2>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="days-selector">
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
        </select>
      </div>

      <div className="analytics-kpi-grid">
        <div className="kpi-card">
          <h3>Total Revenue</h3>
          <div className="kpi-value">₹{data.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="kpi-card">
          <h3>Total Orders</h3>
          <div className="kpi-value">{data.total_orders}</div>
        </div>
        <div className="kpi-card">
          <h3>Top Item</h3>
          <div className="kpi-value kpi-text">
            {data.best_sellers.length > 0 ? data.best_sellers[0].name : 'N/A'}
          </div>
        </div>
      </div>

      <div className="analytics-charts-grid">
        {/* Revenue Chart */}
        <div className="chart-panel">
          <h3>Revenue by Day</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenue_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#97CADB" />
                <YAxis stroke="#97CADB" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#02457A', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => [`₹${value}`, 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#018ABE" strokeWidth={3} dot={{ r: 4, fill: '#018ABE' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Chart */}
        <div className="chart-panel">
          <h3>Peak Hours</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peak_hours}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="hour" stroke="#97CADB" />
                <YAxis stroke="#97CADB" allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#02457A', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => [value, 'Orders']}
                />
                <Bar dataKey="orders" fill="#018ABE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Best Sellers */}
      <div className="analytics-best-sellers">
        <h3>Best Sellers Leaderboard</h3>
        {data.best_sellers.length === 0 ? (
          <p className="no-data">No sales data yet.</p>
        ) : (
          <div className="leaderboard-grid">
            {data.best_sellers.map((item, idx) => (
              <div key={idx} className="leaderboard-item">
                <div className="rank">#{idx + 1}</div>
                <div className="name">{item.name}</div>
                <div className="qty">{item.quantity} sold</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Analytics
