import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { catClassFor } from '../utils/avatar'
import { formatRelativeShort as formatRelative } from '../utils/format'
import {
  IconCaretUp,
  IconCaretDown,
  IconChat,
  IconBookmark,
  IconShare,
  IconCheck,
} from './ActionIcons'

// Mobile post card — Reddit-mobile inspired. Full-bleed media, header
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

function MobilePostCard({ post }) {
  const hasImage = Boolean(post.image_url)
  const initialScore =
    (post.upvote_count ?? post.upvotes ?? 0) -
    (post.downvote_count ?? post.downvotes ?? 0)
  const [score, setScore] = useState(initialScore)
  const [userVote, setUserVote] = useState(null)
  const [pending, setPending] = useState(false)
  const [voteError, setVoteError] = useState(null)

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
      await apiFetch(`/api/posts/${post.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_type: voteType }),
      })
    } catch (err) {
      setScore(prevScore)
      setUserVote(prevVote)
      setVoteError(err.status === 401 ? 'Log in to vote' : 'Vote failed')
      setTimeout(() => setVoteError(null), 2000)
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

  return (
    <article className="bg-card border-t border-ink/10 first:border-t-0">
      {/* Metadata + title — tappable to post detail */}
      <Link
        to={`/post/${post.id}`}
        className="block px-4 pt-4 pb-3 no-underline text-ink"
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {post.category && (
            <span className={`font-archivo font-extrabold text-[0.58rem] uppercase tracking-[0.1em] px-2 py-[3px] ${catClassFor(post.category)}`}>
              {post.category}
            </span>
          )}
          <span className="text-[0.66rem] text-gray font-archivo font-bold uppercase tracking-wider truncate">
            {post.author?.name || 'Anon'} <span className="text-ink/25">·</span> {formatRelative(post.created_at)}
          </span>
        </div>
        <h3 className="font-archivo font-bold text-[1.05rem] leading-[1.22] tracking-tight line-clamp-3">
          {post.title}
        </h3>
      </Link>

      {/* Full-width media — tappable */}
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

      {/* Action row — buttons outside the Link so they fire instead
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
            className={`flex items-center justify-center w-10 h-9 rounded-l-full bg-transparent border-none cursor-pointer disabled:cursor-wait ${
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
            className={`flex items-center justify-center w-10 h-9 rounded-r-full bg-transparent border-none cursor-pointer disabled:cursor-wait ${
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
          className={`flex items-center justify-center w-10 h-9 rounded-full border-none cursor-pointer ${
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
          className={`flex items-center justify-center w-10 h-9 rounded-full border-none cursor-pointer ${
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
