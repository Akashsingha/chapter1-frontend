import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL || 'https://chapter1-backend-1.onrender.com'
const UPI_ID = process.env.REACT_APP_UPI_ID || '7866835502@slc'
const UPI_NAME = process.env.REACT_APP_UPI_NAME || 'UDAY'

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Fix #5 — increased from 15s to 30s for Render cold starts
})

/**
 * Get the dashboard API key stored after successful login.
 */
function getDashboardKey() {
  return localStorage.getItem('dashboardApiKey') || ''
}

/**
 * Create an axios config with the dashboard auth header.
 */
function dashboardConfig() {
  return {
    headers: { 'X-Dashboard-Key': getDashboardKey() },
  }
}

/**
 * Extract a user-friendly error message from an axios error.
 */
function extractErrorMessage(error) {
  if (error.response) {
    const data = error.response.data
    if (typeof data === 'string') return data
    if (data?.detail) {
      // FastAPI validation errors return an array of details
      if (Array.isArray(data.detail)) {
        return data.detail.map(d => d.msg || d).join('. ')
      }
      return data.detail
    }
    if (data?.message) return data.message
    if (data?.error) return data.error
    if (error.response.status === 400) return 'Invalid request. Please check your input and try again.'
    if (error.response.status === 403) return 'Access denied. Please log in again.'
    if (error.response.status === 404) return 'Order not found.'
    if (error.response.status >= 500) return 'Server error. Please try again in a moment.'
    return 'Something went wrong.'
  }
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. The server may be starting up — please try again in 30 seconds.'
  }
  if (!error.response) {
    return 'Could not connect to server. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}

// ── Menu ──────────────────────────────────────────────────

export async function getMenu() {
  try {
    const response = await api.get('/menu')
    return response.data
  } catch (err) {
    // Fix #5 — retry once on timeout (Render cold start)
    if (err.code === 'ECONNABORTED') {
      const response = await api.get('/menu')
      return response.data
    }
    throw err
  }
}

// ── Orders (Customer) ────────────────────────────────────

export async function createOrder({ customer_name, customer_phone, items, payment_method, idempotency_key }) {
  const response = await api.post('/orders', {
    customer_name,
    customer_phone,
    items,
    payment_method,
    idempotency_key, // Fix #6 — sent to backend for duplicate prevention
  })
  return response.data
}

export async function getOrder(orderId) {
  const response = await api.get(`/orders/${orderId}`)
  return response.data
}

// ── Orders (Dashboard — require API key) ─────────────────

export async function getOrders(params = {}) {
  const config = dashboardConfig()
  config.params = params
  const response = await api.get('/orders', config)
  return response.data
}

export async function updateOrderStatus(orderId, status) {
  const response = await api.patch(`/orders/${orderId}/status`, { status }, dashboardConfig())
  return response.data
}

export async function confirmPayment(orderId) {
  const response = await api.patch(
    `/orders/${orderId}/payment`,
    { payment_status: 'confirmed' },
    dashboardConfig()
  )
  return response.data
}

// Fix #11 — Order cancellation
export async function cancelOrder(orderId) {
  const response = await api.patch(`/orders/${orderId}/cancel`, {}, dashboardConfig())
  return response.data
}

// Acknowledge an order — stored in DB so it syncs across all staff devices
export async function acknowledgeOrder(orderId) {
  const response = await api.patch(`/orders/${orderId}/acknowledge`, {}, dashboardConfig())
  return response.data
}

// Toggle a menu item's availability (available ↔ sold out)
export async function toggleMenuAvailability(itemId) {
  const response = await api.patch(`/menu/${itemId}/availability`, {}, dashboardConfig())
  return response.data
}

// ── Inventory & Recipes (Dashboard) ──────────────────────

export async function getInventory() {
  const response = await api.get('/inventory', dashboardConfig())
  return response.data
}

export async function restockInventory(itemId, addedAmount) {
  const response = await api.post('/inventory/restock', { item_id: itemId, added_amount: addedAmount }, dashboardConfig())
  return response.data
}

export async function getRecipes() {
  const response = await api.get('/recipes', dashboardConfig())
  return response.data
}

export async function linkRecipe(menuItemId, inventoryItemId, quantityRequired) {
  const response = await api.post('/recipes/link', {
    menu_item_id: menuItemId,
    inventory_item_id: inventoryItemId,
    quantity_required: quantityRequired
  }, dashboardConfig())
  return response.data
}

// ── Analytics (Dashboard) ────────────────────────────────

export async function getAnalytics(days = 7) {
  const config = dashboardConfig()
  config.params = { days }
  const response = await api.get('/analytics', config)
  return response.data
}

// ── Accounting (Dashboard) ───────────────────────────────

export async function getExpenses(month) {
  const config = dashboardConfig()
  if (month) config.params = { month }
  const response = await api.get('/expenses', config)
  return response.data
}

export async function logExpense(expenseData) {
  const response = await api.post('/expenses', expenseData, dashboardConfig())
  return response.data
}

export async function getAccountingSummary(month) {
  const config = dashboardConfig()
  config.params = { month }
  const response = await api.get('/accounting/summary', config)
  return response.data
}

// ── Waiter Call ──────────────────────────────────────────

export async function callWaiter(tableNumber) {
  const response = await api.post('/call-waiter', { table_number: tableNumber })
  return response.data
}

export async function getWaiterCalls() {
  const response = await api.get('/waiter-calls', dashboardConfig())
  return response.data
}

export async function resolveWaiterCall(callId) {
  const response = await api.patch(`/waiter-calls/${callId}/resolve`, {}, dashboardConfig())
  return response.data
}

// ── Dashboard Auth ───────────────────────────────────────

export async function verifyDashboardPassword(password) {
  const response = await api.post('/verify-dashboard-password', { password })
  return response.data
}

// ── UPI Helper ───────────────────────────────────────────

/**
 * Build a UPI deep-link string.
 * Prefers server-provided upi_string if available on the order.
 */
export function getUpiString(order) {
  if (order.upi_string) return order.upi_string

  const amount = (order.total_amount / 100).toFixed(2)
  // Shorten the note for UPI limit compatibility and readability
  const note = `Order-${order.order_number || order.id.substring(0,4).toUpperCase()}`
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`
}

export function openUpiLink(upiString) {
  const a = document.createElement('a')
  a.href = upiString
  a.target = '_self'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Returns specific app URIs for iOS devices by replacing the generic upi://
 */
export function getSpecificAppUpiLink(upiString, app) {
  switch (app) {
    case 'gpay': return upiString.replace('upi://pay', 'gpay://upi/pay')
    case 'phonepe': return upiString.replace('upi://pay', 'phonepe://pay')
    case 'paytm': return upiString.replace('upi://pay', 'paytmmp://pay')
    default: return upiString
  }
}

export { extractErrorMessage }
export default api
