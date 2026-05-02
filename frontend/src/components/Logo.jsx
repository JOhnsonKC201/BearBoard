// BearBoard wordmark + icon. Single source of truth for the brand mark
// across Navbar, Footer, AuthLayout, and anywhere else we need it.
//
// The icon is a bear silhouette built from circles where the face doubles
// as a bulletin board — the three white lines under the snout represent
// posts. Two color variants:
//   - "navy" (default): navy box, orange features. Use on light surfaces
//     and over the page's existing dark-navy chrome (#0B1D34) — the
//     brighter brand-navy (#002D72) reads as a deliberate contrasting
//     square instead of blending in.
//   - "orange": orange box, navy features. Use as an accent/alt mark
//     anywhere we want extra visual punch (e.g. mobile menu CTA).
//
// Keep the colors in sync with public/favicon.svg — that file is the
// browser-tab equivalent of this component and a drift would make the
// favicon look "wrong" next to the in-page logo.

const COLORS = {
  navy:   { box: '#002D72', features: '#F07F24', pupils: '#002D72' },
  orange: { box: '#F07F24', features: '#002D72', pupils: '#F07F24' },
}

export function LogoIcon({ size = 32, variant = 'navy', className = '', title = 'BearBoard' }) {
  const c = COLORS[variant] || COLORS.navy
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <rect width="80" height="80" rx="17" fill={c.box} />
      {/* Ears */}
      <circle cx="21" cy="27" r="13" fill={c.features} />
      <circle cx="59" cy="27" r="13" fill={c.features} />
      {/* Head */}
      <circle cx="40" cy="51" r="27" fill={c.features} />
      {/* Eyes */}
      <circle cx="31" cy="38" r="3" fill={c.pupils} />
      <circle cx="49" cy="38" r="3" fill={c.pupils} />
      {/* "Bulletin board" lines under the snout — three posts of decreasing length */}
      <rect x="24" y="44" width="32" height="3" rx="1.5" fill="white" opacity="0.85" />
      <rect x="24" y="51" width="24" height="3" rx="1.5" fill="white" opacity="0.85" />
      <rect x="24" y="58" width="17" height="3" rx="1.5" fill="white" opacity="0.85" />
    </svg>
  )
}

// Icon + wordmark in a single inline-flex row. Used by the Navbar and
// Footer brand spots. Wordmark style is opinionated — Archivo Black,
// uppercase, tight tracking — to match the existing site typography.
// `accent` controls the color of the "BOARD" half; defaults to gold so
// existing dark-mode usages stay visually identical to the prior text-only
// wordmark, but the navbar can pass accent="orange" to lean into the new
// brand kit.
export default function Logo({
  size = 28,
  variant = 'navy',
  showWordmark = true,
  textColor = 'white',
  accent = 'gold',
  className = '',
}) {
  const accentClass = accent === 'orange' ? 'text-[#F07F24]' : 'text-gold'
  const baseClass = textColor === 'navy' ? 'text-[#002D72]' : 'text-white'
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoIcon size={size} variant={variant} />
      {showWordmark && (
        <span className={`font-archivo font-black tracking-tight uppercase leading-none ${baseClass}`}>
          BEAR<span className={accentClass}>BOARD</span>
        </span>
      )}
    </span>
  )
}
