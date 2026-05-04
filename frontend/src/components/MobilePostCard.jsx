import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { catClassFor } from '../utils/avatar'
import { formatRelativeShort as formatRelative, formatEventDateTime } from '../utils/format'
import { VerifiedBadge } from './VerifiedBadge'
import PostAuthorMenu from './PostAuthorMenu'
import SosBanner from './SosBanner'
import {
  IconCaretUp,
  IconCaretDown,
  IconChat,
  IconBookmark,
  IconShare,
  IconCheck,
  IconClock,
  IconFire,
} from './ActionIcons'

// Mobile post card - Reddit-mobile inspired. Full-bleed media, header
// with category + author + timestamp, bold title, and an interactive
// action row where the vote pill and save toggle actually work
// without navigating away from the feed.
//
// Tap targets inside the card:
//   - metadata row + title → opens /post/:id
//   - image → opens /post/:id
//   - vote buttons → POST /api/posts/:id/vote (stays on feed)
//   - comment count → opens /post/:id#comments
//   - save → localStorage toggle (shared with desktop PostCard)
//   - share → Web Share API or clipboard

function MobilePostCard({ post, onUpdated, onDeleted }) {
  const { isAuthed } = useAuth()
  const navigate = useNavigate()
  const hasImage = Boolean(post.image_url)
  const isEvent = (post.category || '').toLowerCase() === 'events'
  const eventLabel = isEvent ? formatEventDateTime(post.event_date, post.event_time) : ''
  const initialScore =
    (post.upvote_count ?? post.upvotes ?? 0) -
    (post.downvote_count ?? post.downvotes ?? 0)
  const [score, setScore] = useState(initialScore)
  // Initialize from server-provided vote so the active arrow survives a
  // re-login on mobile too. PR #101 fixed this on desktop but missed
  // the mobile card. See Home.jsx PostCard for the same pattern.
  const [userVote, setUserVote] = useState(post.user_vote || null)
  const [pending, setPending] = useState(false)
  const [voteError, setVoteError] = useState(null)
  const [expanded, setExpanded] = useState(false)
  // Match Reddit's mobile feed behavior:
  //   - Short posts (≤ ~400 chars) render in full, no toggle needed.
  //   - Longer posts collapse to a ~6-line preview with "Read more →"
  //     so the feed stays scrollable without burying short posts under
  //     long ones.
  // Reddit truncates around 250-400 chars; 400 here is the upper end
  // since BearBoard's body font is slightly tighter than Reddit's,
  // so 400 chars fits 5-6 lines comfortably.
  const bodyRaw = post.body || ''
  const bodyTooLong = bodyRaw.length > 400

  const [saved, setSaved] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('bb:saved') || '[]')
      return Array.isArray(raw) && raw.includes(post.id)
    } catch { return false }
  })

  const [shareState, setShareState] = useState(null)

  const applyVote = async (e, voteType) => {
    // Important: stop the click from bubbling into the parent Link
    // wrapping title+metadata so the tap doesn't navigate.
    e.preventDefault()
    e.stopPropagation()
    if (pending) return

    // Voting requires auth. Send unauthed users to login rather than
    // firing a request that'll return 403 and surfacing a vague
    // "Vote failed" error.
    if (!isAuthed) {
      navigate('/login')
      return
    }

    const prevScore = score
    const prevVote = userVote
    let nextScore = score
    let nextVote = userVote
    if (userVote === voteType) {
      nextScore += voteType === 'up' ? -1 : 1
      nextVote = null
    } else if (userVote === null) {
      nextScore += voteType === 'up' ? 1 : -1
      nextVote = voteType
    } else {
      nextScore += voteType === 'up' ? 2 : -2
      nextVote = voteType
    }
    setScore(nextScore)
    setUserVote(nextVote)
    setPending(true)
    setVoteError(null)
    try {
      const result = await apiFetch(`/api/posts/${post.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_type: voteType }),
      })
      // Reconcile against the server's authoritative count (matches PR #101).
      if (result && typeof result.upvotes === 'number') {
        setScore((result.upvotes ?? 0) - (result.downvotes ?? 0))
      }
    } catch (err) {
      setScore(prevScore)
      setUserVote(prevVote)
      // Both 401 (bad token) and 403 (missing auth header) mean "not
      // logged in" from the user's perspective; redirect in that case.
      if (err.status === 401 || err.status === 403) {
        navigate('/login')
      } else {
        setVoteError('Vote failed. Try again.')
        setTimeout(() => setVoteError(null), 2000)
      }
    } finally {
      setPending(false)
    }
  }

  const toggleSave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const set = new Set(JSON.parse(localStorage.getItem('bb:saved') || '[]'))
      if (saved) set.delete(post.id); else set.add(post.id)
      localStorage.setItem('bb:saved', JSON.stringify(Array.from(set)))
    } catch { /* storage unavailable */ }
    setSaved((v) => !v)
  }

  const doShare = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/post/${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareState('copied')
    } catch (err) {
      if (err?.name === 'AbortError') return
      setShareState('failed')
    }
    setTimeout(() => setShareState(null), 1800)
  }

  const upActive = userVote === 'up'
  const downActive = userVote === 'down'
  const isHot = score >= 20

  return (
    <article className={`bg-card border-t border-ink/10 first:border-t-0 relative ${
      post.is_sos && !post.sos_resolved ? 'sos-card bg-[#FBF3F2]' : ''
    }`}>
      {/* Kebab — sits above the tappable header Link. PostAuthorMenu only
          renders for the author or moderators, so non-authors see nothing. */}
      <div className="absolute top-2 right-2 z-10">
        <PostAuthorMenu post={post} onUpdated={onUpdated} onDeleted={onDeleted} />
      </div>

      {/* Loud full-width SOS banner. Replaces the small inline pill that was
          easy to miss while scrolling. Only renders for SOS posts; non-SOS
          cards are byte-identical to before. */}
      {post.is_sos && <SosBanner resolved={post.sos_resolved} size="card" />}

      {/* Metadata + title - tappable to post detail */}
      <Link
        to={`/post/${post.id}`}
        className="block px-4 pt-3 pb-3 pr-12 no-underline text-ink"
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {post.category && (
            <span className={`font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.1em] px-2 py-[3px] ${catClassFor(post.category)}`}>
              {post.category}
            </span>
          )}
          {isHot && (
            <span
              className="font-archivo text-[0.56rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#D4962A] text-white inline-flex items-center gap-1 shrink-0"
              title="High engagement"
            >
              <IconFire /> Hot
            </span>
          )}
          <span className="text-[0.66rem] text-gray font-archivo font-bold uppercase tracking-wider truncate inline-flex items-center gap-1">
            {post.author?.name || 'Anon'}
            <VerifiedBadge user={post.author} size="sm" />
            <span className="text-ink/25">·</span>
            {formatRelative(post.created_at)}
          </span>
        </div>
        <h3 className="font-archivo font-bold text-[1.05rem] leading-[1.22] tracking-tight line-clamp-3">
          {post.title}
        </h3>
      </Link>

      {/* Full-width media - tappable */}
      {hasImage && (
        <Link to={`/post/${post.id}`} className="block bg-navy">
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full aspect-[16/10] object-cover"
          />
        </Link>
      )}

      {/* Inline content — what makes the feed feel like Reddit's mobile feed
          rather than a list of headlines. Skipped entirely when the post has
          no body, no listing chip, and no event metadata so plain title +
          image posts stay visually clean. */}
      {(bodyRaw || post.price || post.contact_info || (isEvent && eventLabel)) && (
        <div className="px-4 pt-2.5 pb-1">
          {(post.price || post.contact_info) && (
            <div className="flex flex-wrap items-center gap-2 mb-2 text-[0.74rem]">
              {post.price && (
                <span className="font-archivo font-extrabold text-navy bg-gold-pale border border-gold/40 px-2 py-[3px] rounded-sm">
                  {post.price}
                </span>
              )}
              {post.contact_info && (
                <span className="text-gray">
                  <span aria-hidden="true">&#9993;</span> {post.contact_info}
                </span>
              )}
            </div>
          )}
          {isEvent && eventLabel && (
            <div className="bg-warning-bg border-l-[3px] border-gold px-3 py-2 mb-2 font-archivo font-bold text-[0.78rem] text-warning flex items-center gap-2">
              <IconClock /> {eventLabel}
            </div>
          )}
          {bodyRaw && (() => {
            // Strip leading whitespace + collapse 3+ newlines to 2 so a
            // body that was visually loose on desktop reads tighter on
            // mobile without losing intentional paragraph breaks.
            const cleaned = bodyRaw.replace(/^\s+/, '').replace(/\n{2,}/g, '\n')
            const collapsed = bodyTooLong && !expanded
            return (
              <div className="relative">
                <div
                  className={`text-[0.92rem] text-ink/85 leading-[1.55] whitespace-pre-wrap font-prose overflow-hidden ${
                    collapsed ? 'max-h-[10rem]' : ''
                  }`}
                >
                  {cleaned}
                </div>
                {collapsed && (
                  // Fade overlay so the truncation reads as intentional.
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent"
                    aria-hidden
                  />
                )}
                {bodyTooLong && (
                  <button
                    type="button"
                    onClick={(e) => {
                      // Stop the event from bubbling — the surrounding
                      // article doesn't navigate, but defensive in case
                      // a future wrapper adds tap-to-expand.
                      e.preventDefault()
                      e.stopPropagation()
                      setExpanded((v) => !v)
                    }}
                    className="relative mt-1 font-archivo text-[0.68rem] font-extrabold uppercase tracking-wider text-navy hover:text-gold bg-transparent border-none cursor-pointer px-0"
                  >
                    {expanded ? 'Show less' : 'Read more →'}
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Action row - buttons outside the Link so they fire instead
          of navigating */}
      <div className="px-3 py-2.5 flex items-center gap-1.5">
        {/* Vote pill */}
        <div
          className={`flex items-center rounded-full border transition-colors min-h-[36px] ${
            upActive
              ? 'bg-gold/15 border-gold/40'
              : downActive
              ? 'bg-danger/10 border-danger/30'
              : 'bg-offwhite border-transparent'
          }`}
        >
          <button
            type="button"
            onClick={(e) => applyVote(e, 'up')}
            aria-label="Upvote"
            aria-pressed={upActive}
            disabled={pending}
            className={`flex items-center justify-center w-11 h-11 rounded-l-full bg-transparent border-none cursor-pointer disabled:cursor-wait ${
              upActive ? 'text-gold' : 'text-gray'
            }`}
          >
            <IconCaretUp filled={upActive} />
          </button>
          <span
            className={`font-archivo font-extrabold text-[0.82rem] min-w-[24px] text-center tabular-nums ${
              upActive ? 'text-gold' : downActive ? 'text-danger' : 'text-ink'
            }`}
          >
            {score}
          </span>
          <button
            type="button"
            onClick={(e) => applyVote(e, 'down')}
            aria-label="Downvote"
            aria-pressed={downActive}
            disabled={pending}
            className={`flex items-center justify-center w-11 h-11 rounded-r-full bg-transparent border-none cursor-pointer disabled:cursor-wait ${
              downActive ? 'text-danger' : 'text-gray'
            }`}
          >
            <IconCaretDown filled={downActive} />
          </button>
        </div>

        {/* Comments */}
        <Link
          to={`/post/${post.id}#comments`}
          className="flex items-center gap-1.5 min-h-[36px] px-3 rounded-full bg-offwhite text-gray text-[0.8rem] font-archivo font-bold no-underline"
          aria-label={`${post.comment_count ?? 0} comments`}
        >
          <IconChat />
          <span className="tabular-nums">{post.comment_count ?? 0}</span>
        </Link>

        <div className="flex-1" />

        {/* Save */}
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save post'}
          className={`flex items-center justify-center w-11 h-11 rounded-full border-none cursor-pointer ${
            saved ? 'bg-gold/15 text-warning' : 'bg-offwhite text-gray'
          }`}
        >
          <IconBookmark filled={saved} />
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={doShare}
          aria-label="Share post"
          className={`flex items-center justify-center w-11 h-11 rounded-full border-none cursor-pointer ${
            shareState === 'copied'
              ? 'bg-success-bg text-success'
              : shareState === 'failed'
              ? 'bg-danger-bg text-danger'
              : 'bg-offwhite text-gray'
          }`}
        >
          {shareState === 'copied' ? <IconCheck /> : <IconShare />}
        </button>
      </div>

      {voteError && (
        <div className="px-4 pb-3 text-[0.68rem] text-danger font-archivo font-bold" role="alert">
          {voteError}
        </div>
      )}
    </article>
  )
}

export default MobilePostCard
