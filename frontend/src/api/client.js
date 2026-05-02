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
// localStorage SWR window — much longer than the in-memory TTL because
// stale-with-revalidate from disk is the difference between a 30-second
// cold-start skeleton and an instant paint. Anything older than this we
// drop on read so users don't see week-old data after a long absence.
const PERSISTED_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h
const STORAGE_KEY = 'bearboard_api_cache_v1'
const STORAGE_MAX_BYTES = 1_000_000 // ~1MB cap — localStorage budget is ~5MB

const cache = new Map()   // key -> { data, ts }
const inflight = new Map() // key -> Promise (dedup in-flight)

function cacheKey(url, token) {
  // Bucket cached responses by a stable token fingerprint so two accounts
  // on the same device don't swap data. Empty fingerprint for logged-out.
  const fp = token ? token.slice(-12) : 'anon'
  return `${fp}::${url}`
}

// -- localStorage persistence -------------------------------------------------
// Hydrates the in-memory cache from localStorage on module load, and writes
// each successful GET back to localStorage. Survives page refreshes so the
// first paint after navigation/reload can serve cached data while the network
// catches up.

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch { return null }
}

function loadFromStorage() {
  const ls = safeStorage()
  if (!ls) return
  try {
    const raw = ls.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    const now = Date.now()
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v.ts !== 'number') continue
      if (now - v.ts > PERSISTED_MAX_AGE_MS) continue
      cache.set(k, { data: v.data, ts: v.ts })
    }
  } catch { /* corrupted blob — ignore and overwrite on next write */ }
}

let writeScheduled = false
function persistCacheSoon() {
  if (writeScheduled) return
  writeScheduled = true
  // Coalesce bursts of cache writes (e.g. Promise.all of 4 GETs) into a
  // single localStorage write at the end of the microtask. Cheap on the
  // happy path, prevents O(n) JSON serialization on parallel fetches.
  Promise.resolve().then(() => {
    writeScheduled = false
    const ls = safeStorage()
    if (!ls) return
    try {
      const obj = {}
      for (const [k, v] of cache.entries()) obj[k] = v
      let serialized = JSON.stringify(obj)
      // If we're over budget, drop oldest entries until we fit. Keeps
      // localStorage from filling up after a long session.
      if (serialized.length > STORAGE_MAX_BYTES) {
        const sorted = [...cache.entries()].sort((a, b) => b[1].ts - a[1].ts)
        const trimmed = {}
        let size = 0
        for (const [k, v] of sorted) {
          const piece = JSON.stringify({ [k]: v }).length
          if (size + piece > STORAGE_MAX_BYTES) break
          trimmed[k] = v
          size += piece
        }
        serialized = JSON.stringify(trimmed)
      }
      ls.setItem(STORAGE_KEY, serialized)
    } catch { /* quota exceeded or serialization failure — drop silently */ }
  })
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() })
  persistCacheSoon()
}

loadFromStorage()

// Manually seed the cache for an endpoint after an out-of-band fetch.
// Used by the /api/home/initial bundle: one network call returns data
// for five separate endpoints, and we want subsequent peekCache() reads
// of those endpoints to hit warm rather than re-fetching. Keyed by the
// current auth token so a different user's tab doesn't see this data.
export function primeCache(endpoint, data) {
  if (typeof endpoint !== 'string' || data === undefined) return
  const url = `${API_URL}${endpoint}`
  let token = null
  try { token = safeStorage()?.getItem('bearboard_token') || null } catch {}
  setCache(cacheKey(url, token), data)
}

// Synchronous read of any cached entry (in-memory + persisted) for an
// endpoint. Returns the raw data if anything is on disk for this user,
// regardless of staleness, so callers can hydrate UI state without waiting
// for the network. Use as initial state in useState() or useMemo() — pair
// with a normal apiFetch() call to revalidate in the background.
export function peekCache(endpoint) {
  if (typeof endpoint !== 'string') return undefined
  const url = `${API_URL}${endpoint}`
  let token = null
  try { token = safeStorage()?.getItem('bearboard_token') || null } catch {}
  const entry = cache.get(cacheKey(url, token))
  if (!entry) return undefined
  if (Date.now() - entry.ts > PERSISTED_MAX_AGE_MS) return undefined
  return entry.data
}

export function invalidateCache(prefix) {
  // Call after a POST/PUT/DELETE to drop stale reads. Pass a URL prefix like
  // `/api/posts` to drop every cached post response. No arg -> clear all.
  if (!prefix) { cache.clear(); persistCacheSoon(); return }
  for (const k of Array.from(cache.keys())) {
    if (k.includes(`::${API_URL}${prefix}`) || k.includes(`::${prefix}`)) {
      cache.delete(k)
    }
  }
  persistCacheSoon()
}

async function rawFetch(url, options, headers) {
  // Strip our own non-RequestInit options (cache=false, ttl=...) so they don't
  // leak into native fetch — `cache` is a string enum there ('no-store' etc),
  // a boolean throws "not a valid enum value of type RequestCache" silently.
  const { cache: _ignoreCache, ttl: _ignoreTtl, ...fetchOpts } = options || {}
  const response = await fetch(url, { ...fetchOpts, headers })
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
          .then((data) => { setCache(key, data); return data })
          .catch(() => entry.data) // swallow background-refresh errors
          .finally(() => inflight.delete(key)),
      )
    }
    return entry.data
  }

  // Miss in-memory but maybe present in localStorage (older than the SWR
  // window but within PERSISTED_MAX_AGE_MS). If so, treat it like the stale
  // branch above: serve cached data immediately, refresh in the background.
  // This is the path that turns a 30-second cold-start skeleton into an
  // instant paint after a page reload.
  if (entry) {
    if (!inflight.has(key)) {
      inflight.set(
        key,
        fetchWithRetry(url, options, headers)
          .then((data) => { setCache(key, data); return data })
          .catch(() => entry.data)
          .finally(() => inflight.delete(key)),
      )
    }
    return entry.data
  }

  // Miss: await the network. Dedup concurrent identical requests.
  if (inflight.has(key)) return inflight.get(key)
  const p = fetchWithRetry(url, options, headers)
    .then((data) => { setCache(key, data); return data })
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

// Race the React mount: kick off the home-bundle fetch as early as
// possible (called from main.jsx, before createRoot). Primes the SWR
// cache so Home.jsx's peekCache() reads return data with no network
// wait. Falls through silently if the request fails — Home.jsx still
// runs its granular per-endpoint fetches as fallbacks.
const HOME_INITIAL_URL = '/api/home/initial'
const HOME_BUNDLE_KEYS = {
  posts: '/api/posts/?sort=newest&limit=50',
  trending: '/api/trending',
  events: '/api/events?limit=24',
  groups: '/api/groups',
  stats: '/api/stats',
}

export function prefetchHomeInitial() {
  // Use apiFetch so the response respects the SWR cache semantics
  // (token-keyed, retried on 502/503 cold starts). Then fan the bundled
  // payload out to the per-endpoint cache keys so the rest of the app
  // can read each slice via peekCache as if it had been fetched
  // separately.
  apiFetch(HOME_INITIAL_URL)
    .then((bundle) => {
      if (!bundle || typeof bundle !== 'object') return
      for (const [field, endpoint] of Object.entries(HOME_BUNDLE_KEYS)) {
        if (bundle[field] !== undefined) primeCache(endpoint, bundle[field])
      }
    })
    .catch(() => { /* network or backend unreachable — granular fetches handle it */ })
}
