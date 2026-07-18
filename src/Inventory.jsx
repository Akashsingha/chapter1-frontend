import { useState, useEffect } from 'react'
import { getInventory, restockInventory, getRecipes, linkRecipe, extractErrorMessage } from './api'
import './Inventory.css'

function Inventory({ menuItems }) {
  const [inventory, setInventory] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [restockItem, setRestockItem] = useState('')
  const [restockAmount, setRestockAmount] = useState('')
  
  const [mapperMenu, setMapperMenu] = useState('')
  const [mapperInv, setMapperInv] = useState('')
  const [mapperQty, setMapperQty] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [invData, recData] = await Promise.all([getInventory(), getRecipes()])
      setInventory(invData)
      setRecipes(recData)
    } catch (err) {
      setError(extractErrorMessage(err))
    }
    setLoading(false)
  }

  async function handleRestock(e) {
    e.preventDefault()
    if (!restockItem || !restockAmount) return
    
    try {
      await restockInventory(restockItem, parseFloat(restockAmount))
      setRestockItem('')
      setRestockAmount('')
      fetchData()
    } catch (err) {
      setError(extractErrorMessage(err))
    }
  }

  async function handleLinkRecipe(e) {
    e.preventDefault()
    if (!mapperMenu || !mapperInv || !mapperQty) return
    
    try {
      await linkRecipe(mapperMenu, mapperInv, parseFloat(mapperQty))
      setMapperMenu('')
      setMapperInv('')
      setMapperQty('')
      fetchData()
    } catch (err) {
      setError(extractErrorMessage(err))
    }
  }

  if (loading) return <div className="inventory-loading">Loading Inventory...</div>

  return (
    <div className="inventory-container">
      {error && <div className="inventory-error">{error}</div>}
      
      <div className="inventory-grid">
        {/* Left Column: Stock Table & Restock */}
        <div className="inventory-panel">
          <h2>Current Stock</h2>
          <table className="stock-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => {
                const isLow = item.current_stock <= item.low_stock_threshold
                return (
                  <tr key={item.id} className={isLow ? 'stock-low' : ''}>
                    <td>{item.name}</td>
                    <td>{item.current_stock?.toFixed(2) || 0} {item.unit}</td>
                    <td>{isLow ? '⚠️ Low' : '✅ Good'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="restock-box">
            <h3>Log New Supply Purchase</h3>
            <form onSubmit={handleRestock} className="restock-form">
              <select value={restockItem} onChange={e => setRestockItem(e.target.value)} required>
                <option value="">Select Item...</option>
                {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input 
                type="number" 
                placeholder="Amount to add" 
                value={restockAmount} 
                onChange={e => setRestockAmount(e.target.value)} 
                required 
                min="0.1" 
                step="0.1" 
              />
              <button type="submit">Restock</button>
            </form>
          </div>
        </div>

        {/* Right Column: Recipe Mapper */}
        <div className="inventory-panel">
          <h2>Recipe Mapper</h2>
          <p className="help-text">Define how much inventory is consumed when a menu item is sold.</p>
          
          <form onSubmit={handleLinkRecipe} className="recipe-form">
            <select value={mapperMenu} onChange={e => setMapperMenu(e.target.value)} required>
              <option value="">Select Menu Item...</option>
              {menuItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            
            <select value={mapperInv} onChange={e => setMapperInv(e.target.value)} required>
              <option value="">Select Ingredient...</option>
              {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            
            <input 
              type="number" 
              placeholder="Quantity required per order" 
              value={mapperQty} 
              onChange={e => setMapperQty(e.target.value)} 
              required 
              min="0.1" 
              step="0.1" 
            />
            <button type="submit">Link Ingredient</button>
          </form>

          <h3 style={{marginTop: '20px'}}>Active Recipe Maps</h3>
          <ul className="recipe-list">
            {recipes.map(recipe => (
              <li key={recipe.id}>
                <strong>{recipe.menu_items?.name}</strong> requires {recipe.quantity_required} {recipe.inventory_items?.unit} of {recipe.inventory_items?.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Inventory
