const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

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
