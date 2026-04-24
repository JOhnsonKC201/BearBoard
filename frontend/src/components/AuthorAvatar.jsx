import { useState } from 'react'
import { paletteFor, ANON_AVATAR } from '../utils/avatar'
import { initialsFor } from '../utils/format'

/**
 * AuthorAvatar — single source of truth for "person chip" rendering across
 * the app (feed, post detail, comments, navbar, mobile cards).
 *
 * Renders the user's uploaded photo (`author.avatar_url`, a base64 data URL
 * served by the backend) when present. Falls back to the initials chip
 * with the deterministic palette assigned to that user id, matching the
 * legacy chip style so unmigrated authors and broken-image cases look
 * intentional rather than "missing".
 *
 * Anonymous posts get the dark anon palette and a "?" glyph regardless
 * of any avatar the underlying user might have, so anonymity is preserved.
 *
 * Props:
 *   author       { id, name, avatar_url? } | null
 *   anonymous    boolean — force the anon palette + "?" glyph
 *   size         'xs' | 'sm' | 'md' | 'lg' (default 'sm')
 *   className    extra classes appended to the wrapper
 *   ringClass    override the ring style (default 'ring-1 ring-black/5')
 *   seedFallback number — used when author?.id is missing (e.g. on a post
 *                whose author was deleted, fall back to post.id so the
 *                color is still stable per-post rather than always slot 0)
 */
export default function AuthorAvatar({
  author,
  anonymous = false,
  size = 'sm',
  className = '',
  ringClass = 'ring-1 ring-black/5',
  seedFallback,
}) {
  const dims = SIZE[size] || SIZE.sm
  const [broken, setBroken] = useState(false)

  // Anonymous wins — we never leak a real photo on an anon post even if
  // the backend mistakenly attached the author's avatar_url.
  if (anonymous) {
    return (
      <span
        aria-hidden
        className={`inline-flex items-center justify-center rounded-full font-archivo font-black shrink-0 ${dims.box} ${dims.text} ${ringClass} ${className}`}
        style={{ background: ANON_AVATAR.bg, color: ANON_AVATAR.tc }}
      >
        ?
      </span>
    )
  }

  const url = (author?.avatar_url || '').trim()
  const seed = author?.id ?? seedFallback ?? 0
  const palette = paletteFor(seed)
  const initials = initialsFor(author?.name)

  if (url && !broken) {
    return (
      <span
        className={`inline-block rounded-full overflow-hidden shrink-0 ${dims.box} ${ringClass} ${className}`}
        style={{ background: palette.bg }}
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className="w-full h-full object-cover block"
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full font-archivo font-black shrink-0 ${dims.box} ${dims.text} ${ringClass} ${className}`}
      style={{ background: palette.bg, color: palette.tc }}
    >
      {initials}
    </span>
  )
}

const SIZE = {
  xs: { box: 'w-5 h-5',  text: 'text-[0.55rem]' },
  sm: { box: 'w-8 h-8',  text: 'text-[0.65rem]' },
  md: { box: 'w-9 h-9',  text: 'text-mini' },
  lg: { box: 'w-11 h-11', text: 'text-[0.78rem]' },
}
