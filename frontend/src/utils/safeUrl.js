// Tiny URL sanitizer for `href` attributes that might receive
// untrusted data (event source URLs synced from external feeds, post
// image URLs, contact info on listings, etc.). Allows only the safe
// schemes you'd ever actually link a campus event to. Falls back to
// '#' on anything else so a hand-crafted `javascript:`, `data:`, or
// `vbscript:` URL can never reach the DOM as a clickable link.

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function safeHref(raw, fallback = '#') {
  const s = String(raw || '').trim()
  if (!s) return fallback
  // Treat schemeless paths as relative — already safe.
  if (s.startsWith('/') || s.startsWith('#') || s.startsWith('?')) return s
  // Treat protocol-relative as https.
  if (s.startsWith('//')) return `https:${s}`
  try {
    const u = new URL(s)
    return SAFE_SCHEMES.has(u.protocol.toLowerCase()) ? s : fallback
  } catch {
    // Not a parseable absolute URL and not a recognizable relative path.
    // Safer to drop than to let a `javascript:` typo through.
    return fallback
  }
}
