// Normalize VITE_API_URL so both full URLs ("https://api.example.com") and
// bare hostnames ("api.example.com") work. Render's Blueprint `fromService`
// interpolation emits just the host, so we prepend https:// when missing.
function normalizeApiUrl(raw) {
  if (!raw) return "http://localhost:8000"
  const trimmed = String(raw).trim().replace(/\/$/, "")
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL)

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`

  // Attach JWT token if available
  const token = localStorage.getItem('bearboard_token')
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    headers,
    ...options,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.detail || `Request failed with status ${response.status}`)
    error.status = response.status
    error.data = errorData
    throw error
  }

  const data = await response.json()
  return data
}
