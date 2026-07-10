import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL || 'https://chapter1-backend-1.onrender.com'
const UPI_ID = process.env.REACT_APP_UPI_ID || '7866835502@slc'
const UPI_NAME = process.env.REACT_APP_UPI_NAME || 'UDAY'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
})

/**
 * Extract a user-friendly error message from an axios error.
 */
function extractErrorMessage(error) {
  if (error.response) {
    // Server responded with an error
    const data = error.response.data
    if (typeof data === 'string') return data
    if (data?.message) return data.message
    if (data?.error) return data.error
    if (error.response.status === 400) return 'Invalid order. Please check your items and try again.'
    if (error.response.status === 404) return 'Order not found.'
    if (error.response.status >= 500) return 'Server error. Please try again in a moment.'
    return 'Something went wrong.'
  }
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. The server may be starting up — please try again.'
  }
  if (!error.response) {
    return 'Could not connect to server. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}

// ── Menu ──────────────────────────────────────────────────

export async function getMenu() {
  const response = await api.get('/menu')
  return response.data
}

// ── Orders (Customer) ────────────────────────────────────

export async function createOrder({ customer_name, customer_phone, items, payment_method }) {
  const response = await api.post('/orders', {
    customer_name,
    customer_phone,
    items,
    payment_method,
  })
  return response.data
}

export async function getOrder(orderId) {
  const response = await api.get(`/orders/${orderId}`)
  return response.data
}

// ── Orders (Dashboard) ───────────────────────────────────

export async function getOrders(params = {}) {
  const response = await api.get('/orders', { params })
  return response.data
}

export async function updateOrderStatus(orderId, status) {
  const response = await api.patch(`/orders/${orderId}/status`, { status })
  return response.data
}

export async function confirmPayment(orderId) {
  const response = await api.patch(`/orders/${orderId}/payment`, {
    payment_status: 'confirmed',
  })
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
  const note = `Order-${order.id}`
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`
}

export { extractErrorMessage }
export default api
