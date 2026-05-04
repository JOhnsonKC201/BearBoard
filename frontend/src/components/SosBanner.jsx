import { IconSiren } from './ActionIcons'

/**
 * SosBanner — single source of truth for the SOS visual identity.
 *
 * Renders a loud full-width bar above a post (or below the masthead, depending
 * on caller layout). Two states:
 *
 *   - unresolved → flashing dark-red bar, animated siren, "IMMEDIATE HELP NEEDED"
 *   - resolved   → calm dark-green bar, static siren, "SOS RESOLVED"
 *
 * Two sizes:
 *
 *   - "card"   → compact for feed cards (Home PostCard, MobilePostCard, Profile)
 *   - "detail" → taller, more padding, larger type for the post detail page
 *
 * Animation is driven by the `.sos-banner` class (defined in
 * frontend/src/index.css) which cross-fades the bar between two reds. That
 * class respects `prefers-reduced-motion`, so reduced-motion users see a
 * static dark-red bar — still loud, just not flickering.
 *
 * Keep this the only place SOS chrome lives. Adding a new surface that needs
 * to surface SOS = `<SosBanner resolved={post.sos_resolved} size="card" />`,
 * not another custom badge to drift over time.
 */
function SosBanner({ resolved = false, size = 'card' }) {
  const isDetail = size === 'detail'
  const baseCls = isDetail
    ? 'px-5 sm:px-7 py-3.5'
    : 'px-4 py-2.5'
  const labelCls = isDetail
    ? 'text-[0.78rem] sm:text-[0.88rem]'
    : 'text-[0.66rem] sm:text-[0.7rem]'
  const iconWrap = isDetail ? 'w-9 h-9' : 'w-7 h-7'

  if (resolved) {
    // Static — once the SOS is resolved we want the visual energy to
    // drop. Same shape/structure as the unresolved banner so the layout
    // doesn't shift, but the color flips to teal/green and the
    // sos-banner animation class is omitted.
    return (
      <div
        role="status"
        aria-label="SOS resolved — help has arrived"
        className={`bg-[#0F5E54] text-white flex items-center gap-3 ${baseCls}`}
      >
        <span
          aria-hidden
          className={`shrink-0 ${iconWrap} rounded-full bg-white/15 flex items-center justify-center`}
        >
          <IconSiren />
        </span>
        <div className="min-w-0">
          <div className={`font-archivo font-black uppercase tracking-[0.16em] ${labelCls}`}>
            SOS Resolved
          </div>
          <div className="text-white/85 text-[0.72rem] sm:text-[0.78rem] font-franklin leading-snug">
            Help has arrived. The author or a moderator has marked this resolved.
          </div>
        </div>
      </div>
    )
  }

  // Unresolved — the loud one. `sos-banner` adds the cross-fade animation.
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`sos-banner text-white flex items-center gap-3 ${baseCls}`}
    >
      <span
        aria-hidden
        className={`shrink-0 ${iconWrap} rounded-full bg-white/20 flex items-center justify-center animate-pulse`}
      >
        <IconSiren />
      </span>
      <div className="min-w-0">
        <div className={`font-archivo font-black uppercase tracking-[0.18em] ${labelCls} flex items-center gap-1.5`}>
          <span aria-hidden>🚨</span>
          SOS · Immediate help needed
        </div>
        <div className="text-white/90 text-[0.72rem] sm:text-[0.78rem] font-franklin leading-snug">
          A student in your area has flagged this as urgent.
          {isDetail ? ' Read carefully and help if you can.' : ''}
        </div>
      </div>
    </div>
  )
}

export default SosBanner
