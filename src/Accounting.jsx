import { useState, useEffect } from 'react'
import { getAccountingSummary, getExpenses, logExpense, extractErrorMessage } from './api'
import './Accounting.css'

function Accounting() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [summary, setSummary] = useState(null)
  const [expenses, setExpenses] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Expense Form State
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('supplies')
  const [description, setDescription] = useState('')

  useEffect(() => {
    fetchData()
  }, [month])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [sumData, expData] = await Promise.all([
        getAccountingSummary(month),
        getExpenses(month)
      ])
      setSummary(sumData)
      setExpenses(expData)
    } catch (err) {
      setError(extractErrorMessage(err))
    }
    setLoading(false)
  }

  async function handleAddExpense(e) {
    e.preventDefault()
    if (!amount || !description) return

    try {
      await logExpense({
        amount: parseFloat(amount),
        category,
        description,
        date_logged: new Date().toISOString()
      })
      setAmount('')
      setDescription('')
      fetchData() // refresh
    } catch (err) {
      setError(extractErrorMessage(err))
    }
  }

  if (loading && !summary) return <div className="accounting-loading">Loading books...</div>

  return (
    <div className="accounting-container">
      <div className="accounting-header">
        <h2>Profit & Loss</h2>
        <input 
          type="month" 
          value={month} 
          onChange={e => setMonth(e.target.value)} 
          className="month-selector"
        />
      </div>

      {error && <div className="accounting-error">{error}</div>}

      {summary && (
        <div className="pl-scorecard">
          <div className="pl-item">
            <h3>Gross Revenue (Orders)</h3>
            <div className="pl-value revenue">₹{summary.total_revenue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
          </div>
          <div className="pl-operator">−</div>
          <div className="pl-item">
            <h3>Total Expenses</h3>
            <div className="pl-value expense">₹{summary.total_expenses.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
          </div>
          <div className="pl-operator">=</div>
          <div className="pl-item net-profit">
            <h3>Net Profit</h3>
            <div className={`pl-value ${summary.net_profit >= 0 ? 'revenue' : 'expense'}`}>
              ₹{summary.net_profit.toLocaleString('en-IN', {minimumFractionDigits: 2})}
            </div>
          </div>
        </div>
      )}

      <div className="accounting-grid">
        {/* Left: Add Expense Form */}
        <div className="accounting-panel">
          <h2>Log Expense</h2>
          <form onSubmit={handleAddExpense} className="expense-form">
            <div className="form-group">
              <label>Amount (₹)</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                required 
                min="1" 
                step="0.1" 
                placeholder="e.g. 1500"
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="supplies">Supplies & Inventory</option>
                <option value="salary">Staff Salary</option>
                <option value="rent">Rent</option>
                <option value="utility">Utility (Electricity/Water)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input 
                type="text" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                required 
                placeholder="e.g. Milk for the week"
              />
            </div>
            <button type="submit" className="btn-log-expense">Save Expense</button>
          </form>
        </div>

        {/* Right: Expenses Table */}
        <div className="accounting-panel">
          <h2>Logged Expenses ({month})</h2>
          {expenses.length === 0 ? (
            <p className="no-expenses">No expenses logged this month.</p>
          ) : (
            <div className="expenses-table-wrapper">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style={{textAlign: 'right'}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id}>
                      <td>{new Date(exp.date_logged).toLocaleDateString()}</td>
                      <td style={{textTransform: 'capitalize'}}>{exp.category}</td>
                      <td>{exp.description}</td>
                      <td style={{textAlign: 'right', color: '#ff4444'}}>
                        -₹{exp.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Accounting
