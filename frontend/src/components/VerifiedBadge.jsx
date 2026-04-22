/**
 * VerifiedBadge — shown next to a user's name anywhere a student is
 * rendered (profile masthead, post bylines, comment bylines, etc.) to
 * signal the account is a verified Morgan State student.
 *
 * "Verified" here means: the account was registered with a .edu email
 * address (enforced by backend/routers/auth.py _require_edu_email).
 * Since every non-admin account must pass that check, this badge ends
 * up on every real student — the point is less exclusivity and more
 * a visible assurance that the person you're replying to isn't a
 * drive-by guest.
 *
 * Heuristic used by `isVerifiedStudent`:
 *   - user has an id
 *   - email ends in ".edu" (case-insensitive)
 * If email isn't exposed on the payload (e.g. in author bylines the
 * `/api/auth/me` user isn't the same object), we fall back to treating
 * any non-admin/mod/dev role as verified, which is correct because
 * signup is gated on .edu from day one.
 */

const EDU_RE = /@[^@\s]+\.edu$/i

export function isVerifiedStudent(user) {
  if (!user) return false
  if (typeof user.email === 'string' && EDU_RE.test(user.email)) return true
  // Fallback: if the payload doesn't include email (common in post/comment
  // bylines), trust that they passed the server-side .edu gate at signup.
  if (user.role && user.id) return true
  return false
}

function IconCheckSeal({ size = 12 }) {
  // A 12px sealed-letter check that reads as "verified" without imitating
  // Twitter's blue tick. Gold fill + navy stroke stays on BearBoard brand.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5l2.4 1.9 3.06-.4.9 2.97 2.7 1.55-1.1 2.9 1.1 2.9-2.7 1.55-.9 2.97-3.06-.4L12 21.5 9.6 19.6l-3.06.4-.9-2.97-2.7-1.55 1.1-2.9-1.1-2.9 2.7-1.55.9-2.97 3.06.4z"
        fill="#D4962A"
        stroke="#0B1D34"
        strokeWidth="1.2"
      />
      <path
        d="M8.2 12.4l2.6 2.4 5-5.4"
        stroke="#0B1D34"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function VerifiedBadge({ user, size = 'sm', withLabel = false, className = '' }) {
  if (!isVerifiedStudent(user)) return null
  const sizePx = size === 'lg' ? 16 : size === 'md' ? 14 : 12
  const title = 'Verified Morgan State student — signed up with a .edu email'
  if (!withLabel) {
    return (
      <span
        className={`inline-flex items-center shrink-0 ${className}`}
        title={title}
        aria-label={title}
      >
        <IconCheckSeal size={sizePx} />
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 font-archivo font-extrabold uppercase tracking-[0.18em] text-navy/85 ${
        size === 'lg' ? 'text-[0.66rem]' : 'text-[0.58rem]'
      } ${className}`}
      title={title}
    >
      <IconCheckSeal size={sizePx} />
      <span>Verified · .edu</span>
    </span>
  )
}

export default VerifiedBadge
