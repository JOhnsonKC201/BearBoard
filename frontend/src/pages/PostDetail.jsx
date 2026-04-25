import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PostDetailSkeleton } from '../components/Skeletons'
import { formatRelativeTime as formatRelative, initialsFor } from '../utils/format'
import { catClassFor, paletteFor, flairLabel } from '../utils/avatar'
import { IconCaretUp, IconCaretDown, IconChat, IconBookmark, IconShare, IconCheck } from '../components/ActionIcons'
import PostAuthorMenu from '../components/PostAuthorMenu'
import RoleBadge from '../components/RoleBadge'
import { VerifiedBadge } from '../components/VerifiedBadge'

function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, isAuthed } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState(null)
  const [related, setRelated] = useState([])
  const composerRef = useRef(null)

  const issueDate = useMemo(() => {
    if (!post?.created_at) return ''
    try {
      const d = new Date(post.created_at)
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    } catch { return '' }
  }, [post?.created_at])

  const load = () => {
    setLoading(true)
    setError(null)
    apiFetch(`/api/posts/${id}`)
      .then((data) => setPost(data))
      .catch((err) => setError(err.message || 'Failed to load post'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Fetch a few posts from the same section for the "More from…" rail.
  // Runs after the post resolves so we know which category to query.
  useEffect(() => {
    if (!post?.category) { setRelated([]); return }
    let cancelled = false
    const params = new URLSearchParams({
      category: post.category,
      sort: 'newest',
      limit: '6',
    })
    apiFetch(`/api/posts/?${params.toString()}`)
      .then((rows) => {
        if (cancelled) return
        const filtered = (rows || []).filter((p) => p.id !== post.id).slice(0, 3)
        setRelated(filtered)
      })
      .catch(() => { if (!cancelled) setRelated([]) })
    return () => { cancelled = true }
  }, [post?.id, post?.category])

  const submitComment = async (e) => {
    e.preventDefault()
    setCommentError(null)
    if (!commentBody.trim()) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim() }),
      })
      setCommentBody('')
      load()
    } catch (err) {
      setCommentError(err.status === 401 ? 'Log in to comment' : (err.message || 'Failed to post comment'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <PostDetailSkeleton />
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center flex-col gap-2">
        <p className="text-gray font-archivo">{error || 'Post not found'}</p>
        <Link to="/" className="text-gold font-archivo font-extrabold text-mini uppercase tracking-wide">
          Back to feed
        </Link>
      </div>
    )
  }

  const categoryKey = (post.category || 'general').toLowerCase()
  const catClass = catClassFor(post.category)
  const isAnonymous = categoryKey === 'anonymous'
  const authorName = isAnonymous ? 'Anonymous' : (post.author?.name || 'Unknown')
  const authorMajor = isAnonymous ? '' : (post.author?.major || '')
  const avatar = paletteFor(isAnonymous ? -1 : post.author?.id ?? post.id)
  const initials = isAnonymous ? '?' : initialsFor(authorName)
  const commentCount = (post.comments || []).length

  const focusComposer = (e) => {
    e?.preventDefault?.()
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => composerRef.current?.focus(), 350)
  }

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Masthead strip — sectional header, broadsheet style */}
      <div className="border-b border-lightgray bg-offwhite">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="text-gray text-mini font-archivo font-bold uppercase tracking-[0.18em] hover:text-ink inline-flex items-center gap-1.5 min-h-[36px] no-underline"
          >
            <span aria-hidden>&larr;</span> Back to feed
          </Link>
          <div className="hidden sm:flex items-center gap-3 text-2xs font-archivo font-extrabold uppercase tracking-[0.22em] text-gray">
            <span>{issueDate || '—'}</span>
            <span aria-hidden className="text-lightgray">/</span>
            <span className={`px-2 py-[3px] ${catClass}`}>{flairLabel(post.category)}</span>
            <span aria-hidden className="text-lightgray">/</span>
            <span>No. {String(post.id).padStart(4, '0')}</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[64px_1fr_260px] gap-6 lg:gap-8">
        {/* LEFT: vote rail (desktop) — sticky as the user scrolls long posts/comments */}
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <PostVoteRail post={post} onUpdate={(patch) => setPost((p) => ({ ...p, ...patch }))} />
          </div>
        </aside>

        {/* CENTER: featured article + comments */}
        <main className="min-w-0">
          <article className="bg-card border border-lightgray border-l-[3px] border-l-gold relative">
            {/* Featured-article header */}
            <header className="px-5 sm:px-8 pt-7 pb-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xs font-archivo font-extrabold uppercase tracking-[0.24em] text-gray">
                  Feature
                </span>
                <span aria-hidden className="h-px flex-1 bg-lightgray" />
                <PostAuthorMenu
                  post={post}
                  onUpdated={(updated) => setPost((prev) => ({ ...prev, ...updated }))}
                  onDeleted={() => navigate('/')}
                />
              </div>

              <h1 className="font-editorial font-black text-[1.85rem] sm:text-[2.4rem] leading-[1.05] tracking-tight text-ink mb-4">
                {post.title}
              </h1>

              {/* Byline strip */}
              <div className="flex items-center gap-3 pt-3 border-t border-divider">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-archivo font-black text-mini shrink-0 ring-1 ring-black/5"
                  style={{ background: avatar.bg, color: avatar.tc }}
                  aria-hidden
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-[0.88rem] font-semibold leading-tight">{authorName}</strong>
                    {!isAnonymous && <VerifiedBadge user={post.author} size="sm" />}
                    {!isAnonymous && <RoleBadge role={post.author?.role} />}
                  </div>
                  <div className="text-2xs text-gray font-archivo uppercase tracking-wider mt-0.5">
                    {authorMajor && <>{authorMajor} <span className="text-lightgray mx-1">/</span></>}
                    {formatRelative(post.created_at)}
                  </div>
                </div>
              </div>
            </header>

            {post.image_url && (
              <div className="bg-black/85 overflow-hidden border-y border-divider">
                <img
                  src={post.image_url}
                  alt=""
                  loading="lazy"
                  className="w-full max-h-[480px] object-contain mx-auto"
                />
              </div>
            )}

            {/* Body — editorial column */}
            <div className="px-5 sm:px-8 py-6">
              {/* Mobile vote rail (lg:hidden) — surfaces voting on small screens */}
              <div className="lg:hidden mb-5">
                <PostVoteRail post={post} onUpdate={(patch) => setPost((p) => ({ ...p, ...patch }))} horizontal />
              </div>

              <div className="font-franklin text-[1.02rem] sm:text-[1.06rem] text-ink leading-[1.65] whitespace-pre-wrap selection:bg-gold/30">
                {/* Drop-cap on the first letter of long posts */}
                {(post.body || '').length > 240 ? (
                  <>
                    <span className="float-left font-editorial font-black text-[3.4rem] leading-[0.85] mr-2 mt-1 text-navy">
                      {post.body.charAt(0)}
                    </span>
                    {post.body.slice(1)}
                  </>
                ) : (
                  post.body
                )}
              </div>
            </div>

            {/* Action bar — share / save / jump-to-reply */}
            <div className="px-5 sm:px-8 py-3 border-t border-divider flex items-center gap-2 flex-wrap bg-offwhite/40">
              <ActionButtons post={post} onJumpToReply={focusComposer} commentCount={commentCount} />
            </div>
          </article>

          {related.length > 0 && (
            <RelatedPosts items={related} category={post.category} />
          )}

          {/* Letters to the Editor — comments section */}
          <section className="mt-10" aria-labelledby="comments-heading">
            <div className="flex items-baseline gap-3 mb-4">
              <h2
                id="comments-heading"
                className="font-editorial font-black text-[1.5rem] sm:text-[1.7rem] tracking-tight leading-none text-ink"
              >
                Letters
              </h2>
              <span className="h-px flex-1 bg-lightgray" aria-hidden />
              <span className="text-2xs font-archivo font-extrabold uppercase tracking-[0.22em] text-gray tabular-nums">
                {commentCount} {commentCount === 1 ? 'reply' : 'replies'}
              </span>
            </div>

            {/* Composer — featured "write a letter" block */}
            <form
              onSubmit={submitComment}
              className="bg-card border border-lightgray border-l-[3px] border-l-navy mb-6 px-4 sm:px-5 pt-4 pb-3"
            >
              <label
                htmlFor="post-comment-body"
                className="block text-2xs font-archivo font-extrabold uppercase tracking-[0.22em] text-gray mb-2"
              >
                {isAuthed ? 'Add to the conversation' : 'Sign in to reply'}
              </label>
              <textarea
                id="post-comment-body"
                ref={composerRef}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                disabled={submitting || !isAuthed}
                rows={3}
                className="w-full bg-offwhite/60 border border-transparent focus:border-navy focus:bg-card px-3 py-2.5 text-[0.95rem] font-franklin leading-relaxed resize-y outline-none transition-colors disabled:opacity-60"
                placeholder={isAuthed ? 'Share what you think…' : 'Log in to comment.'}
              />
              {commentError && (
                <div className="text-mini text-danger mt-2 font-archivo font-bold" role="alert">
                  {commentError}
                </div>
              )}
              <div className="flex items-center justify-between mt-2 gap-2">
                <span className="text-2xs text-gray font-archivo uppercase tracking-wider">
                  {commentBody.length > 0 ? `${commentBody.length} chars` : 'Be respectful. Be specific.'}
                </span>
                {isAuthed ? (
                  <button
                    type="submit"
                    disabled={submitting || !commentBody.trim()}
                    className="bg-navy text-gold border-none py-2 px-4 min-h-[40px] font-archivo text-mini font-extrabold uppercase tracking-[0.14em] cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Posting…' : 'Publish reply'}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="bg-navy text-gold no-underline py-2 px-4 min-h-[40px] inline-flex items-center font-archivo text-mini font-extrabold uppercase tracking-[0.14em] hover:bg-[#132d4a] transition-colors"
                  >
                    Log in to reply
                  </Link>
                )}
              </div>
            </form>

            {commentCount === 0 ? (
              <div className="bg-card border border-dashed border-lightgray px-5 py-8 text-center">
                <div className="font-editorial italic text-[1.1rem] text-gray leading-snug mb-1">
                  &ldquo;The page is blank.&rdquo;
                </div>
                <p className="text-mini text-gray font-archivo uppercase tracking-wider">
                  No letters yet — be the first to write in.
                </p>
              </div>
            ) : (
              <ol className="list-none p-0 m-0 space-y-2">
                {post.comments.map((c, idx) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    index={idx + 1}
                    postId={post.id}
                    currentUser={currentUser}
                    onChange={load}
                  />
                ))}
              </ol>
            )}
          </section>
        </main>

        {/* RIGHT: thread metadata rail (desktop) — fills the empty whitespace
            using only data already on `post`, no extra fetches */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-3">
            <ThreadMetaCard
              post={post}
              issueDate={issueDate}
              authorName={authorName}
              avatar={avatar}
              initials={initials}
              commentCount={commentCount}
              onJumpToReply={focusComposer}
              isAnonymous={isAnonymous}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  PostVoteRail                                                              */
/*                                                                            */
/*  Vertical (desktop sidebar) and horizontal (mobile inline) variants of     */
/*  the post vote control. Optimistic update + rollback on failure, mirrors   */
/*  the PostCard implementation in Home.jsx so behavior stays consistent.     */
/* -------------------------------------------------------------------------- */
function PostVoteRail({ post, onUpdate, horizontal = false }) {
  const { isAuthed } = useAuth()
  const navigate = useNavigate()
  const initialScore = (post.upvotes ?? 0) - (post.downvotes ?? 0)
  const [score, setScore] = useState(initialScore)
  const [userVote, setUserVote] = useState(null)
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState(null)
  const [popKey, setPopKey] = useState(0)

  const apply = async (voteType) => {
    if (pending) return
    if (!isAuthed) { navigate('/login'); return }

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
    setScore(nextScore); setUserVote(nextVote); setPopKey((k) => k + 1)
    setPending(true); setErr(null)
    try {
      await apiFetch(`/api/posts/${post.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_type: voteType }),
      })
      onUpdate?.({})
    } catch (e) {
      setScore(prevScore); setUserVote(prevVote)
      if (e.status === 401 || e.status === 403) navigate('/login')
      else { setErr('Vote failed'); setTimeout(() => setErr(null), 1800) }
    } finally {
      setPending(false)
    }
  }

  const upActive = userVote === 'up'
  const downActive = userVote === 'down'

  if (horizontal) {
    return (
      <div className="inline-flex items-center bg-offwhite border border-lightgray rounded-full">
        <button
          type="button"
          onClick={() => apply('up')}
          aria-label="Upvote"
          aria-pressed={upActive}
          disabled={pending}
          className={`flex items-center justify-center w-9 h-9 rounded-l-full bg-transparent border-none cursor-pointer transition-colors ${
            upActive ? 'text-gold' : 'text-gray hover:text-navy'
          }`}
        >
          <IconCaretUp filled={upActive} />
        </button>
        <span
          key={popKey}
          className={`font-archivo font-extrabold text-[0.95rem] min-w-[36px] text-center vote-pop tabular-nums ${
            upActive ? 'text-gold' : downActive ? 'text-danger' : 'text-ink'
          }`}
        >
          {score}
        </span>
        <button
          type="button"
          onClick={() => apply('down')}
          aria-label="Downvote"
          aria-pressed={downActive}
          disabled={pending}
          className={`flex items-center justify-center w-9 h-9 rounded-r-full bg-transparent border-none cursor-pointer transition-colors ${
            downActive ? 'text-danger' : 'text-gray hover:text-navy'
          }`}
        >
          <IconCaretDown filled={downActive} />
        </button>
        {err && <span className="ml-2 text-2xs text-danger font-archivo font-bold uppercase tracking-wider">{err}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center bg-card border border-lightgray py-3 w-[64px]">
      <button
        type="button"
        onClick={() => apply('up')}
        aria-label="Upvote"
        aria-pressed={upActive}
        disabled={pending}
        title={isAuthed ? 'Upvote' : 'Log in to vote'}
        className={`w-10 h-10 flex items-center justify-center bg-transparent border-none cursor-pointer rounded-sm transition-colors ${
          upActive ? 'text-gold bg-gold/10' : 'text-gray hover:text-navy hover:bg-offwhite'
        }`}
      >
        <span className="scale-150"><IconCaretUp filled={upActive} /></span>
      </button>
      <span
        key={popKey}
        className={`font-archivo font-black text-[1.15rem] my-1 vote-pop tabular-nums leading-none ${
          upActive ? 'text-gold' : downActive ? 'text-danger' : 'text-ink'
        }`}
        aria-live="polite"
      >
        {score}
      </span>
      <span className="text-[0.55rem] font-archivo font-extrabold uppercase tracking-[0.2em] text-gray mb-1">
        votes
      </span>
      <button
        type="button"
        onClick={() => apply('down')}
        aria-label="Downvote"
        aria-pressed={downActive}
        disabled={pending}
        title={isAuthed ? 'Downvote' : 'Log in to vote'}
        className={`w-10 h-10 flex items-center justify-center bg-transparent border-none cursor-pointer rounded-sm transition-colors ${
          downActive ? 'text-danger bg-danger-bg/40' : 'text-gray hover:text-navy hover:bg-offwhite'
        }`}
      >
        <span className="scale-150"><IconCaretDown filled={downActive} /></span>
      </button>
      {err && (
        <span className="mt-1 text-[0.55rem] text-danger font-archivo font-bold uppercase tracking-wider text-center px-1">
          {err}
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  ActionButtons — share, save, jump-to-reply for the post.                  */
/* -------------------------------------------------------------------------- */
function ActionButtons({ post, onJumpToReply, commentCount }) {
  const [saved, setSaved] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('bb:saved') || '[]')
      return Array.isArray(raw) && raw.includes(post.id)
    } catch { return false }
  })
  const toggleSave = () => {
    try {
      const set = new Set(JSON.parse(localStorage.getItem('bb:saved') || '[]'))
      if (saved) set.delete(post.id); else set.add(post.id)
      localStorage.setItem('bb:saved', JSON.stringify(Array.from(set)))
    } catch { /* storage unavailable */ }
    setSaved((v) => !v)
  }

  const [shareState, setShareState] = useState(null)
  const doShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareState('copied')
    } catch (err) {
      if (err && err.name === 'AbortError') return
      setShareState('failed')
    }
    setTimeout(() => setShareState(null), 1800)
  }

  const btn = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-mini font-archivo font-bold border-none cursor-pointer transition-colors'

  return (
    <>
      <button
        type="button"
        onClick={onJumpToReply}
        className={`${btn} bg-offwhite text-gray hover:text-navy hover:bg-[#EDE9DF]`}
      >
        <IconChat />
        <span className="tabular-nums">{commentCount}</span>
        <span className="hidden sm:inline">Reply</span>
      </button>
      <button
        type="button"
        onClick={toggleSave}
        aria-pressed={saved}
        className={`${btn} ${saved ? 'bg-gold/15 text-warning hover:bg-gold/25' : 'bg-offwhite text-gray hover:text-navy hover:bg-[#EDE9DF]'}`}
      >
        <IconBookmark filled={saved} />
        <span>{saved ? 'Saved' : 'Save'}</span>
      </button>
      <button
        type="button"
        onClick={doShare}
        className={`${btn} ${
          shareState === 'copied' ? 'bg-success-bg text-success'
          : shareState === 'failed' ? 'bg-danger-bg text-danger'
          : 'bg-offwhite text-gray hover:text-navy hover:bg-[#EDE9DF]'
        }`}
      >
        {shareState === 'copied' ? <IconCheck /> : <IconShare />}
        <span>{shareState === 'copied' ? 'Copied' : shareState === 'failed' ? 'Failed' : 'Share'}</span>
      </button>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  RelatedPosts — "More from [Section]" strip placed between the article    */
/*  and the comments. Renders up to three same-category posts as compact     */
/*  broadsheet-style cards.                                                   */
/* -------------------------------------------------------------------------- */
function RelatedPosts({ items, category }) {
  return (
    <section className="mt-10" aria-labelledby="related-heading">
      <div className="flex items-baseline gap-3 mb-4">
        <h2
          id="related-heading"
          className="font-editorial font-black text-[1.35rem] sm:text-[1.5rem] tracking-tight leading-none text-ink"
        >
          More from <span className="italic">{flairLabel(category)}</span>
        </h2>
        <span className="h-px flex-1 bg-lightgray" aria-hidden />
        <span className="text-2xs font-archivo font-extrabold uppercase tracking-[0.22em] text-gray tabular-nums">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'}
        </span>
      </div>
      <ol className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((p) => (
          <RelatedPostCard key={p.id} post={p} />
        ))}
      </ol>
    </section>
  )
}

function RelatedPostCard({ post }) {
  const isAnonymous = (post.category || '').toLowerCase() === 'anonymous'
  const authorName = isAnonymous ? 'Anonymous' : (post.author?.name || 'Unknown')
  const score = (post.upvotes ?? 0) - (post.downvotes ?? 0)
  const replies = post.comment_count ?? 0
  return (
    <li className="bg-card border border-lightgray border-l-[3px] border-l-gold/70 hover:border-l-gold hover:border-navy/30 transition-colors">
      <Link
        to={`/post/${post.id}`}
        className="block px-4 py-3 no-underline text-ink h-full"
      >
        <div className="text-2xs font-archivo font-extrabold uppercase tracking-[0.2em] text-gray mb-1.5">
          {formatRelative(post.created_at)}
        </div>
        <h3 className="font-editorial font-black text-[1.05rem] leading-[1.15] tracking-tight text-ink mb-1.5 line-clamp-3">
          {post.title}
        </h3>
        <div className="flex items-center gap-2 text-2xs font-archivo uppercase tracking-wider text-gray">
          <span className="truncate">{authorName}</span>
          <span aria-hidden className="text-lightgray">/</span>
          <span className="tabular-nums">{score} pts</span>
          <span aria-hidden className="text-lightgray">/</span>
          <span className="tabular-nums">{replies} {replies === 1 ? 'reply' : 'replies'}</span>
        </div>
      </Link>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/*  ThreadMetaCard — broadsheet-style "about this dispatch" sidebar.          */
/*                                                                            */
/*  Renders only from data already on `post`, so the page costs no extra      */
/*  network calls beyond the existing /api/posts/{id} fetch.                  */
/* -------------------------------------------------------------------------- */
function ThreadMetaCard({ post, issueDate, authorName, avatar, initials, commentCount, onJumpToReply, isAnonymous }) {
  const score = (post.upvotes ?? 0) - (post.downvotes ?? 0)
  const total = (post.upvotes ?? 0) + (post.downvotes ?? 0)
  const ratio = total > 0 ? Math.round((post.upvotes / total) * 100) : null

  return (
    <div className="bg-card border border-lightgray">
      <div className="px-4 py-3 border-b border-divider bg-navy text-gold">
        <div className="text-2xs font-archivo font-extrabold uppercase tracking-[0.22em] opacity-80">
          The Dispatch
        </div>
        <div className="font-editorial font-black text-[1.1rem] leading-tight mt-0.5">
          About this thread
        </div>
      </div>

      <dl className="px-4 py-3 text-mini font-franklin space-y-2.5">
        <MetaRow label="Filed">{issueDate || '—'}</MetaRow>
        <MetaRow label="Section">
          <span className={`px-1.5 py-[2px] font-archivo font-extrabold text-2xs uppercase tracking-wider ${catClassFor(post.category)}`}>
            {flairLabel(post.category)}
          </span>
        </MetaRow>
        <MetaRow label="Score">
          <span className="font-archivo font-extrabold text-ink tabular-nums">{score}</span>
          {ratio !== null && (
            <span className="text-2xs text-gray uppercase tracking-wider ml-1.5">
              {ratio}% up
            </span>
          )}
        </MetaRow>
        <MetaRow label="Replies">
          <span className="font-archivo font-extrabold text-ink tabular-nums">{commentCount}</span>
        </MetaRow>
        {!isAnonymous && (
          <MetaRow label="Byline">
            <span className="inline-flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center font-archivo font-black text-[0.55rem] ring-1 ring-black/5"
                style={{ background: avatar.bg, color: avatar.tc }}
                aria-hidden
              >
                {initials}
              </span>
              <span className="font-semibold text-ink truncate">{authorName}</span>
            </span>
          </MetaRow>
        )}
      </dl>

      <button
        type="button"
        onClick={onJumpToReply}
        className="w-full text-left px-4 py-3 border-t border-divider bg-offwhite hover:bg-[#EDE9DF] cursor-pointer border-x-0 border-b-0 transition-colors"
      >
        <span className="text-2xs font-archivo font-extrabold uppercase tracking-[0.2em] text-gray">
          Write a letter
        </span>
        <span className="block font-editorial italic text-[0.95rem] text-navy mt-0.5">
          Have something to add? &rarr;
        </span>
      </button>
    </div>
  )
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-2xs font-archivo font-extrabold uppercase tracking-[0.18em] text-gray w-[60px] shrink-0">
        {label}
      </dt>
      <dd className="flex-1 min-w-0 text-ink m-0">{children}</dd>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  CommentRow — one "letter to the editor" with author chip, broadsheet     */
/*  numbering, and inline edit/delete for the author or moderators.           */
/* -------------------------------------------------------------------------- */
function CommentRow({ comment, index, postId, currentUser, onChange }) {
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const isAuthor = currentUser && comment.author_id === currentUser.id
  const isMod = currentUser && (currentUser.role === 'moderator' || currentUser.role === 'admin')
  const canEdit = isAuthor
  const canDelete = isAuthor || isMod

  const authorName = comment.author?.name || 'Unknown'
  const avatar = paletteFor(comment.author?.id ?? comment.id)
  const initials = initialsFor(authorName)

  const save = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) { setErr('Reply cannot be empty'); return }
    setBusy(true); setErr(null)
    try {
      await apiFetch(`/api/posts/${postId}/comments/${comment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ body }),
      })
      setEditing(false)
      onChange?.()
    } catch (e2) {
      setErr(e2?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    setBusy(true); setErr(null)
    try {
      await apiFetch(`/api/posts/${postId}/comments/${comment.id}`, { method: 'DELETE' })
      onChange?.()
    } catch (e2) {
      setErr(e2?.message || 'Delete failed')
      setBusy(false)
    }
  }

  return (
    <li className="bg-card border border-lightgray hover:border-gold/40 transition-colors group/letter">
      <div className="px-4 sm:px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-archivo font-black text-[0.62rem] shrink-0 ring-1 ring-black/5"
            style={{ background: avatar.bg, color: avatar.tc }}
            aria-hidden
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <strong className="text-[0.84rem] font-semibold text-ink truncate">{authorName}</strong>
              {isAuthor && (
                <span className="text-2xs font-archivo font-extrabold uppercase tracking-wider text-gold">
                  You
                </span>
              )}
              <span className="text-gray/50 text-2xs" aria-hidden>&bull;</span>
              <span className="text-2xs text-gray font-archivo uppercase tracking-wider">
                {formatRelative(comment.created_at)}
              </span>
              <span className="ml-auto text-2xs font-archivo font-black tracking-wider text-lightgray tabular-nums" aria-hidden>
                №{String(index).padStart(2, '0')}
              </span>
            </div>

            {editing ? (
              <form onSubmit={save} className="mt-1">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  disabled={busy}
                  className="w-full border border-lightgray bg-offwhite/50 focus:bg-card focus:border-navy px-3 py-2 text-[0.92rem] font-franklin leading-relaxed resize-y outline-none transition-colors"
                />
                {err && <div className="text-2xs text-danger font-archivo font-bold mt-1 uppercase tracking-wider">{err}</div>}
                <div className="flex gap-2 mt-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="bg-navy text-gold border-none py-1.5 px-3 font-archivo text-2xs font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#132d4a] transition-colors disabled:opacity-60"
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => { setEditing(false); setDraft(comment.body); setErr(null) }}
                    className="bg-transparent border border-lightgray py-1.5 px-3 font-archivo text-2xs font-extrabold uppercase tracking-wider text-gray hover:text-ink cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <blockquote className="text-[0.92rem] text-ink font-franklin leading-[1.6] whitespace-pre-wrap m-0 border-l-2 border-divider pl-3 group-hover/letter:border-gold/60 transition-colors">
                {comment.body}
              </blockquote>
            )}

            {!editing && (canEdit || canDelete) && (
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/letter:opacity-100 focus-within:opacity-100 transition-opacity">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => { setEditing(true); setDraft(comment.body); setErr(null) }}
                    className="text-2xs font-archivo font-extrabold uppercase tracking-[0.16em] text-gray hover:text-navy px-1.5 py-1 bg-transparent border-none cursor-pointer"
                  >
                    Edit
                  </button>
                )}
                {canDelete && !confirm && (
                  <button
                    type="button"
                    onClick={() => setConfirm(true)}
                    className="text-2xs font-archivo font-extrabold uppercase tracking-[0.16em] text-gray hover:text-danger px-1.5 py-1 bg-transparent border-none cursor-pointer"
                  >
                    Delete
                  </button>
                )}
                {canDelete && confirm && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={del}
                      disabled={busy}
                      className="text-2xs font-archivo font-extrabold uppercase tracking-wider text-white bg-danger hover:bg-[#6a1313] px-2 py-1 border-none cursor-pointer disabled:opacity-60"
                    >
                      {busy ? '…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(false)}
                      disabled={busy}
                      className="text-2xs font-archivo font-extrabold uppercase tracking-wider text-gray hover:text-ink px-1.5 py-1 bg-transparent border-none cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
            {err && !editing && (
              <div className="text-2xs text-danger font-archivo font-bold mt-1 uppercase tracking-wider">{err}</div>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

export default PostDetail
