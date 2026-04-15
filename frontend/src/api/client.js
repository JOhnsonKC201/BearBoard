// Base API client for making requests to the backend
// TODO: Read API_URL from environment variable (import.meta.env.VITE_API_URL)

const API_URL = "http://localhost:8000"

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`

  // TODO: Attach JWT token from auth context to Authorization header
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  })

  // BUG: No error handling — if the API returns an error, this silently fails
  const data = await response.json()
  return data
}
