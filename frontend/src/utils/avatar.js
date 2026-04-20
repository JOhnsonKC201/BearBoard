// Shared avatar palette used by post authors across the feed, profile, and
// mobile dashboard. Six colorways cycle deterministically based on user id
// so the same person always gets the same avatar. Anonymous posts use a
// dedicated dark palette.

export const AVATAR_PALETTE = [
  { bg: 'linear-gradient(135deg, #6B4AA0 0%, #3F2270 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #19314F 0%, #0B1D34 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #2BA89A 0%, #137267 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #D45347 0%, #962E22 100%)', tc: '#FFFFFF' },
  { bg: 'linear-gradient(135deg, #EAA841 0%, #B47A14 100%)', tc: '#0B1D34' },
  { bg: 'linear-gradient(135deg, #4A8A4D 0%, #234C25 100%)', tc: '#FFFFFF' },
]

export const ANON_AVATAR = {
  bg: 'linear-gradient(135deg, #2A2A2A 0%, #0B0B0B 100%)',
  tc: '#FFFFFF',
}

export function paletteFor(seed) {
  if (seed === -1) return ANON_AVATAR
  return AVATAR_PALETTE[Math.abs(seed ?? 0) % AVATAR_PALETTE.length]
}

// Tailwind classes for category pill backgrounds + text. Keep in sync with
// the backend's category enum. Anything not listed falls back to "general".
export const CAT_STYLES = {
  events: 'bg-gold-pale text-[#8B6914]',
  academic: 'bg-[#D1E3F5] text-navy',
  recruiters: 'bg-[#E6D8F0] text-purple',
  social: 'bg-[#D0EDE9] text-[#0F5E54]',
  general: 'bg-[#E5E3DE] text-[#5A5A5A]',
  anonymous: 'bg-[#1A1A1A] text-white',
  housing: 'bg-[#FCE8D2] text-[#8A4B16]',
  swap: 'bg-[#DDE6C5] text-[#4A5A1F]',
  safety: 'bg-[#F5D5D0] text-[#8B1A1A]',
}

export function catClassFor(category) {
  const key = String(category || 'general').toLowerCase()
  return CAT_STYLES[key] || CAT_STYLES.general
}
