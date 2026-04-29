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

// -----------------------------------------------------------------------------
// In-memory cache for idempotent GETs with a stale-while-revalidate pattern.
//
// Why: Render's free tier cold-boots in 30-60s. On warm-up many pages do the
// same 3-4 GETs (stats, trending, events, groups). Serving them from an in-tab
// cache means a user returning from Profile -> Home doesn't re-fetch what they
// just loaded, and the UI has something to show immediately if the network is
// slow.
//
// Behavior:
//   - fresh  (age < TTL)       -> resolve with cached data, no network
//   - stale  (TTL <= age < 2xTTL) -> resolve with cached data AND kick off a
//                                   background revalidation for next time
//   - miss   (no entry, >2xTTL) -> normal fetch, store on success
//
// Only plain GETs with no `cache: false` opt-out are cached. Token-scoped
// endpoints (the token is sent in the Authorization header) include the token
// fingerprint in the cache key so a different user in the same tab can't read
// another user's cached /me or /auth/me.
// -----------------------------------------------------------------------------

const DEFAULT_TTL_MS = 30_000 // 30s feels fresh enough for a social feed
const STALE_MULTIPLIER = 2    // data older than this is a miss, not stale

const cache = new Map()   // key -> { data, ts }
const inflight = new Map() // key -> Promise (dedup in-flight)

function cacheKey(url, token) {
  // Bucket cached responses by a stable token fingerprint so two accounts
  // on the same device don't swap data. Empty fingerprint for logged-out.
  const fp = token ? token.slice(-12) : 'anon'
  return `${fp}::${url}`
}

export function invalidateCache(prefix) {
  // Call after a POST/PUT/DELETE to drop stale reads. Pass a URL prefix like
  // `/api/posts` to drop every cached post response. No arg -> clear all.
  if (!prefix) { cache.clear(); return }
  for (const k of Array.from(cache.keys())) {
    if (k.includes(`::${API_URL}${prefix}`) || k.includes(`::${prefix}`)) {
      cache.delete(k)
    }
  }
}

async function rawFetch(url, options, headers) {
  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.detail || `Request failed with status ${response.status}`)
    error.status = response.status
    error.data = errorData
    throw error
  }
  return response.json()
}

// Retry with exponential backoff on 1) network/TypeError or 2) 502/503/504.
// Sized to absorb a Render free-tier cold boot (typically 30-60s) so the user
// sees data instead of an error after the first request following idle.
// Schedule: immediate, +2s, +4s, +8s, +16s, +32s — six attempts, ~62s budget.
async function fetchWithRetry(url, options, headers) {
  const delays = [0, 2000, 4000, 8000, 16000, 32000]
  let lastErr
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay))
    try {
      return await rawFetch(url, options, headers)
    } catch (err) {
      const retryable =
        err instanceof TypeError || // network error, CORS, DNS
        err.status === 502 || err.status === 503 || err.status === 504
      if (!retryable) throw err
      lastErr = err
    }
  }
  throw lastErr
}

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`
  const method = (options.method || 'GET').toUpperCase()

  const token = localStorage.getItem('bearboard_token')
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  // Non-GETs bypass the cache entirely and invalidate reads under the same
  // resource prefix so follow-up GETs see fresh data.
  if (method !== 'GET' || options.cache === false) {
    const data = await fetchWithRetry(url, options, headers)
    if (method !== 'GET') {
      // Invalidate the collection the mutation plausibly touched. Conservative
      // prefix drops: a POST to /api/posts/123/vote drops /api/posts/*.
      const segs = endpoint.split('?')[0].split('/').filter(Boolean)
      if (segs.length >= 2) invalidateCache(`/${segs[0]}/${segs[1]}`)
    }
    return data
  }

  const ttl = typeof options.ttl === 'number' ? options.ttl : DEFAULT_TTL_MS
  const key = cacheKey(url, token)
  const entry = cache.get(key)
  const age = entry ? Date.now() - entry.ts : Infinity

  // Fresh: no network at all.
  if (entry && age < ttl) return entry.data

  // Stale-while-revalidate: return cached data, refresh in the background.
  if (entry && age < ttl * STALE_MULTIPLIER) {
    if (!inflight.has(key)) {
      inflight.set(
        key,
        fetchWithRetry(url, options, headers)
          .then((data) => { cache.set(key, { data, ts: Date.now() }); return data })
          .catch(() => entry.data) // swallow background-refresh errors
          .finally(() => inflight.delete(key)),
      )
    }
    return entry.data
  }

  // Miss: await the network. Dedup concurrent identical requests.
  if (inflight.has(key)) return inflight.get(key)
  const p = fetchWithRetry(url, options, headers)
    .then((data) => { cache.set(key, { data, ts: Date.now() }); return data })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

// Fire-and-forget health ping. Call once on app load to kick Render awake
// so subsequent user-visible fetches hit a warm instance.
export function warmBackend() {
  if (typeof fetch === 'undefined') return
  fetch(`${API_URL}/health`, { method: 'GET' }).catch(() => {})
}
