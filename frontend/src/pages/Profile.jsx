import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../api/client'
import { ProfileSkeleton } from '../components/Skeletons'
import RoleBadge from '../components/RoleBadge'
import AdminDashboard from '../components/AdminDashboard'
import EditProfileModal from '../components/EditProfileModal'
import { useAuth } from '../context/AuthContext'
import { initialsFor as getInitials, formatRelativeTime as formatTimeAgo } from '../utils/format'
import { catClassFor } from '../utils/avatar'
import {
  IconCaretUp,
  IconChat,
  IconSiren,
  IconCalendar,
  IconBookmark,
} from '../components/ActionIcons'

/* -----------------------------------------------------------------------
 * Profile — "Campus Dossier"
 *
 * Each profile is rendered as a featured editorial piece in the BearBoard
 * broadsheet. Fraunces (serif, variable italic axis) carries the warm
 * personal voice; Archivo Black carries the institutional chrome.
 *
 * IMAGE UPLOADS (interim): banner and avatar are stored as data URLs in
 * localStorage keyed by user id, so the UX works today without waiting on
 * new backend endpoints. When the backend adds these:
 *     POST /api/users/me/avatar   (multipart form field: file)  -> { url }
 *     POST /api/users/me/banner   (multipart form field: file)  -> { url }
 *     DELETE /api/users/me/avatar | /banner
 * ...swap the setImageForUser helper to persist via apiFetch and read the
 * url off the returned user record instead of localStorage.
 * --------------------------------------------------------------------- */

const PROFILE_PALETTE = [
  { color: '#5B3A8C', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #6B4AA0 0%, #2A1C4D 100%)' },
  { color: '#0B1D34', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #19314F 0%, #050D1C 100%)' },
  { color: '#1A8A7D', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #2BA89A 0%, #0A4A43 100%)' },
  { color: '#C0392B', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #D45347 0%, #6B1F16 100%)' },
  { color: '#D4962A', tc: '#0B1D34', banner: 'linear-gradient(135deg, #EAA841 0%, #8A5A0F 100%)' },
  { color: '#2C5F2D', tc: '#FFFFFF', banner: 'linear-gradient(135deg, #4A8A4D 0%, #1A3A1B 100%)' },
]

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const DAYS_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const ACTIVITY_DAYS = 30

function getPalette(user) {
  const seed = (user?.id ?? 0) % PROFILE_PALETTE.length
  return PROFILE_PALETTE[seed]
}

function formatJoinDate(iso) {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** "VOL. III · ISSUE #247 · THURSDAY APRIL 23, 2026" — the folio strip. */
function folioFor(user) {
  const now = new Date()
  const joined = user?.created_at ? new Date(user.created_at) : now
  const issue = Math.max(1, Math.floor((now - joined) / (1000 * 60 * 60 * 24)) + 1)
  const year = joined.getFullYear() || now.getFullYear()
  const vol = Math.max(1, now.getFullYear() - year + 1)
  const toRoman = (n) => {
    const map = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]]
    let s = '', x = n
    for (const [r, v] of map) while (x >= v) { s += r; x -= v }
    return s
  }
  const dow = DAYS_SHORT[now.getDay()]
  const mo = MONTHS_SHORT[now.getMonth()]
  return `VOL. ${toRoman(vol)} · ISSUE №${issue.toString().padStart(3, '0')} · ${dow} ${mo} ${now.getDate()}, ${now.getFullYear()}`
}

/** Persisted-locally image store — swap for backend endpoints when ready. */
function imageKey(userId, kind) { return `bearboard_user_${userId}_${kind}` }
function readImage(userId, kind) {
  try { return localStorage.getItem(imageKey(userId, kind)) || null } catch { return null }
}
function writeImage(userId, kind, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(imageKey(userId, kind), dataUrl)
    else localStorage.removeItem(imageKey(userId, kind))
  } catch { /* quota exceeded — ignore */ }
}
function readFileAsDataURL(file, maxBytes = 1_200_000) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'))
    if (file.size > maxBytes) return reject(new Error(`Image too large (>${Math.round(maxBytes/1000)}KB)`))
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Read failed'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

/* =========================================================================
 * Grain + texture atmospherics — applied once at the page level.
 * ========================================================================= */
function PaperGrain() {
  // Inline SVG noise turbulence -> tiny, cacheable, no image asset needed.
  const bg = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0.04  0 0 0 0 0.04  0 0 0 0 0.04  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.45] mix-blend-multiply"
      style={{ backgroundImage: bg, backgroundSize: '220px 220px' }}
    />
  )
}

/* =========================================================================
 * Folio bar — narrow metadata strip at the very top.
 * ========================================================================= */
function FolioBar({ user }) {
  return (
    <div className="border-b-[3px] border-b-navy bg-[#F7F1E3]">
      <div className="max-w-[1200px] mx-auto px-6 py-1.5 flex items-center justify-between text-[0.62rem] font-archivo font-extrabold tracking-[0.18em] text-navy/75 uppercase">
        <span>BearBoard · Profile</span>
        <span className="hidden sm:inline">{folioFor(user)}</span>
        <Link to="/" className="text-navy hover:text-gold no-underline transition-colors">
          ← Back to feed
        </Link>
      </div>
    </div>
  )
}

/* =========================================================================
 * Banner — feature photo with drop-to-upload for self.
 * ========================================================================= */
function BannerZone({ palette, bannerUrl, canEdit, onPick, onClear, saving }) {
  const inputRef = useRef(null)
  const hasImage = Boolean(bannerUrl)
  return (
    <div
      className="relative w-full h-[180px] sm:h-[240px] md:h-[280px] overflow-hidden border-b-[6px] border-b-gold"
      style={{ background: hasImage ? '#0B1D34' : palette.banner }}
    >
      {hasImage && (
        <img
          src={bannerUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      )}
      {/* Diagonal linework — nods to the broadsheet hatching on the mobile home */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.09] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 18px)' }}
      />
      {/* Bottom darkening so the name stays legible against any photo */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

      {/* Corner folio marks — subtle newspaper feel */}
      <div className="absolute top-3 right-4 text-[0.6rem] font-archivo font-extrabold tracking-[0.22em] text-white/85 uppercase drop-shadow-md">
        BearBoard · Dossier
      </div>

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
              e.target.value = ''
            }}
          />
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className="bg-white/90 hover:bg-white text-navy font-archivo font-extrabold text-[0.68rem] uppercase tracking-wide px-3 py-2 min-h-[36px] border-none cursor-pointer disabled:opacity-60 transition-colors flex items-center gap-1.5 shadow-md"
            >
              <IconCamera />
              {saving ? 'Saving…' : hasImage ? 'Change banner' : 'Upload banner'}
            </button>
            {hasImage && !saving && (
              <button
                type="button"
                onClick={onClear}
                className="bg-white/90 hover:bg-danger-bg text-navy hover:text-danger font-archivo font-extrabold text-[0.68rem] uppercase tracking-wide px-3 py-2 min-h-[36px] border-none cursor-pointer transition-colors shadow-md"
                title="Remove banner"
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* =========================================================================
 * Avatar — circular, gold-ringed, half-overlapping the banner.
 * ========================================================================= */
function AvatarZone({ user, palette, avatarUrl, canEdit, onPick, onClear, saving }) {
  const inputRef = useRef(null)
  const initials = getInitials(user.name)
  const hasImage = Boolean(avatarUrl)
  const active = (user.streak_count ?? 0) > 0
  return (
    <div className="relative shrink-0 -mt-[70px] sm:-mt-[84px] md:-mt-[96px]">
      <div
        className={`w-[132px] h-[132px] sm:w-[156px] sm:h-[156px] md:w-[176px] md:h-[176px] rounded-full flex items-center justify-center font-archivo font-black text-[2.6rem] sm:text-[3rem] md:text-[3.4rem] shrink-0 ring-[5px] shadow-[0_10px_30px_-10px_rgba(11,29,52,0.5)] relative overflow-hidden`}
        style={{
          background: hasImage ? '#0B1D34' : palette.color,
          color: palette.tc,
          // Gold inner ring animates in if they have an active streak.
          boxShadow: active ? '0 0 0 3px #D4962A, 0 10px 30px -10px rgba(11,29,52,0.5)' : undefined,
          borderColor: '#F7F1E3',
          borderWidth: '5px',
          borderStyle: 'solid',
        }}
      >
        {hasImage ? (
          <img src={avatarUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        ) : (
          <span aria-hidden>{initials}</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={saving}
            className="absolute inset-0 bg-black/0 hover:bg-black/45 transition-colors group flex items-center justify-center text-white cursor-pointer border-none disabled:cursor-not-allowed"
            aria-label="Upload profile photo"
          >
            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-archivo font-extrabold text-[0.64rem] uppercase tracking-widest flex items-center gap-1">
              <IconCamera /> {saving ? 'Saving…' : 'Change'}
            </span>
          </button>
        )}
      </div>
      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
              e.target.value = ''
            }}
          />
          {hasImage && !saving && (
            <button
              type="button"
              onClick={onClear}
              className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white text-navy border border-lightgray hover:border-danger hover:text-danger flex items-center justify-center cursor-pointer shadow-md text-[0.9rem] font-bold leading-none"
              title="Remove photo"
            >
              ×
            </button>
          )}
        </>
      )}
      {active && (
        <div
          className="absolute -bottom-1 right-1 bg-gold text-navy text-[0.58rem] font-archivo font-black uppercase tracking-wider px-2 py-[3px] rounded-full shadow-md flex items-center gap-1 whitespace-nowrap"
          title={`${user.streak_count}-day streak`}
        >
          <span aria-hidden>🔥</span>
          {user.streak_count}d
        </div>
      )}
    </div>
  )
}

/* Tiny camera glyph used in upload buttons. Avoids a new icon import. */
function IconCamera({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

/* =========================================================================
 * Nameplate — the absurdly-large name rendered in Fraunces italic.
 * ========================================================================= */
function Nameplate({ user, palette, avatarUrl, isSelf, onEdit, onPickAvatar, onClearAvatar, avatarSaving }) {
  const handle = (user.name || '').split(/\s+/)[0]?.toLowerCase() || 'student'
  return (
    <div className="relative">
      {/* The name block slots in under the banner. Left: avatar. Right: text. */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 relative">
        <div className="flex flex-col sm:flex-row sm:items-end sm:gap-6">
          <AvatarZone
            user={user}
            palette={palette}
            avatarUrl={avatarUrl}
            canEdit={isSelf}
            onPick={onPickAvatar}
            onClear={onClearAvatar}
            saving={avatarSaving}
          />
          <div className="flex-1 min-w-0 mt-3 sm:mt-0 sm:pb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.22em] text-navy/70">
                A BearBoard Feature
              </span>
              <span className="text-gold">•</span>
              <RoleBadge role={user.role} size="lg" />
            </div>

            <h1
              className="font-editorial leading-[0.88] text-navy mt-2 tracking-[-0.02em]"
              style={{
                fontSize: 'clamp(2.6rem, 7vw, 5.2rem)',
                fontStyle: 'italic',
                fontWeight: 500,
                fontVariationSettings: '"opsz" 144',
              }}
            >
              {user.name || 'Unnamed'}
            </h1>

            <div className="mt-2 flex items-center gap-3 flex-wrap text-[0.82rem] text-navy/75 font-franklin">
              <span className="font-archivo font-extrabold tracking-wide uppercase text-[0.7rem]">
                u/{handle}
              </span>
              {user.major && (
                <>
                  <span className="text-gold">·</span>
                  <span>{user.major}</span>
                </>
              )}
              {user.graduation_year && (
                <>
                  <span className="text-gold">·</span>
                  <span>Class of {user.graduation_year}</span>
                </>
              )}
              {user.created_at && (
                <>
                  <span className="text-gold">·</span>
                  <span className="text-navy/60 italic font-editorial">Joined {formatJoinDate(user.created_at)}</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 sm:mt-0 sm:pb-2 flex gap-2 shrink-0">
            {isSelf ? (
              <button
                type="button"
                onClick={onEdit}
                className="bg-navy text-gold hover:bg-[#132d4a] border-none py-2.5 px-5 font-archivo text-[0.72rem] font-extrabold uppercase tracking-widest cursor-pointer transition-colors min-h-[42px]"
              >
                Edit dossier
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="bg-navy text-white hover:bg-[#132d4a] border-none py-2.5 px-5 font-archivo text-[0.72rem] font-extrabold uppercase tracking-widest cursor-pointer transition-colors min-h-[42px]"
                >
                  + Follow
                </button>
                <button
                  type="button"
                  className="bg-card border border-navy text-navy hover:bg-navy hover:text-white py-2.5 px-5 font-archivo text-[0.72rem] font-extrabold uppercase tracking-widest cursor-pointer transition-colors min-h-[42px]"
                >
                  Message
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
 * BioQuote — bio rendered as an editorial pull quote.
 * ========================================================================= */
function BioQuote({ user, isSelf, onEdit }) {
  const text = (user.bio || '').trim()
  const fallback = (() => {
    if (user.major && user.graduation_year) {
      return `Studying ${user.major}, Class of ${user.graduation_year} at Morgan State. A quiet reader, an occasional poster.`
    }
    if (user.major) return `${user.major} student at Morgan State. New to BearBoard.`
    return 'A Morgan State student on BearBoard.'
  })()
  const body = text || fallback
  const letter = body.charAt(0)
  const rest = body.slice(1)
  return (
    <figure className="max-w-[860px] mx-auto px-4 sm:px-8 py-10 md:py-14 relative">
      <span
        aria-hidden
        className="absolute left-2 -top-2 sm:-top-4 text-gold/80 font-editorial leading-none select-none"
        style={{ fontSize: 'clamp(5rem, 11vw, 9rem)', fontStyle: 'italic', fontWeight: 700 }}
      >
        “
      </span>
      <span
        aria-hidden
        className="absolute right-2 -bottom-5 sm:-bottom-8 text-gold/80 font-editorial leading-none select-none"
        style={{ fontSize: 'clamp(5rem, 11vw, 9rem)', fontStyle: 'italic', fontWeight: 700 }}
      >
        ”
      </span>

      <blockquote
        className="relative text-navy font-editorial"
        style={{ fontSize: 'clamp(1.15rem, 2vw, 1.55rem)', lineHeight: 1.45, fontWeight: 400 }}
      >
        <span
          className="float-left mr-2 font-editorial text-navy"
          style={{
            fontSize: 'clamp(3.4rem, 6.5vw, 5rem)',
            lineHeight: 0.85,
            fontWeight: 600,
            marginTop: '0.15em',
            fontStyle: 'normal',
          }}
        >
          {letter}
        </span>
        <span style={{ fontStyle: text ? 'normal' : 'italic' }}>
          {rest}
        </span>
      </blockquote>

      <figcaption className="mt-5 flex items-center gap-3 text-[0.68rem] font-archivo font-extrabold uppercase tracking-[0.22em] text-navy/60">
        <span className="h-[1px] w-8 bg-navy/60" />
        {text ? 'In their own words' : 'Pending a bio'}
        {isSelf && !text && (
          <button
            type="button"
            onClick={onEdit}
            className="normal-case tracking-normal font-franklin text-[0.78rem] text-gold hover:text-navy underline underline-offset-2 bg-transparent border-none cursor-pointer"
          >
            — write yours
          </button>
        )}
      </figcaption>
    </figure>
  )
}

/* =========================================================================
 * Beats — categories they've posted in, rendered as newspaper beat tags.
 * ========================================================================= */
function BeatsRow({ posts }) {
  const beats = useMemo(() => {
    const counts = new Map()
    for (const p of posts) {
      const c = (p.category || 'general').toLowerCase()
      counts.set(c, (counts.get(c) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [posts])

  if (!beats.length) return null
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-3 flex-wrap border-t border-b border-navy/80 py-3">
        <span className="font-archivo font-black text-[0.66rem] uppercase tracking-[0.24em] text-navy">
          Beats covered
        </span>
        <span className="text-gold">—</span>
        {beats.map(([cat, count]) => (
          <span
            key={cat}
            className={`inline-flex items-center gap-1.5 font-archivo font-extrabold text-[0.62rem] uppercase tracking-widest px-2.5 py-1 rounded-full ${catClassFor(cat)}`}
          >
            {cat}
            <span className="text-navy/70">×{count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* =========================================================================
 * Activity ribbon — 30-day heatmap from posts.
 * ========================================================================= */
function ActivityRibbon({ posts }) {
  const days = useMemo(() => {
    const out = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const byDay = new Map()
    for (const p of posts) {
      if (!p.created_at) continue
      const d = new Date(p.created_at)
      d.setHours(0, 0, 0, 0)
      const k = d.getTime()
      byDay.set(k, (byDay.get(k) || 0) + 1)
    }
    for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      out.push({ date: d, count: byDay.get(d.getTime()) || 0 })
    }
    return out
  }, [posts])

  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div className="bg-card border border-lightgray overflow-hidden">
      <div className="bg-navy text-gold px-4 py-3 font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest flex items-center justify-between">
        <span>Last 30 days</span>
        <span className="text-gold/70 text-[0.6rem] tracking-[0.22em]">ACTIVITY RIBBON</span>
      </div>
      <div className="px-3 py-3.5">
        <div className="grid grid-cols-30 gap-[3px]" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}>
          {days.map((d, i) => {
            const intensity = d.count === 0 ? 0 : Math.min(1, d.count / max)
            const bg = d.count === 0
              ? '#EAE7E0'
              : `rgba(212, 150, 42, ${0.35 + intensity * 0.65})`
            return (
              <div
                key={i}
                className="aspect-square rounded-[2px]"
                style={{ background: bg }}
                title={`${d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${d.count} post${d.count === 1 ? '' : 's'}`}
              />
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[0.6rem] font-archivo font-extrabold uppercase tracking-[0.18em] text-gray">
          <span>30d ago</span>
          <span className="flex items-center gap-1">
            Less
            <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-[#EAE7E0]" />
            <span className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: 'rgba(212,150,42,0.55)' }} />
            <span className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: 'rgba(212,150,42,0.85)' }} />
            <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-gold" />
            More
          </span>
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
 * Post card — the main feed-style card used in the Writings tab.
 * ========================================================================= */
function PostCard({ post, featured = false }) {
  const cat = (post.category || 'general').toLowerCase()
  const catCls = catClassFor(cat)
  const score = (post.upvotes ?? 0) - (post.downvotes ?? 0)
  return (
    <Link
      to={`/post/${post.id}`}
      className={`block bg-card border border-lightgray hover:border-l-gold transition-all no-underline text-ink overflow-hidden ${
        featured ? 'border-l-[4px] border-l-gold shadow-[0_6px_24px_-14px_rgba(11,29,52,0.4)]' : 'border-l-[3px] border-l-lightgray hover:-translate-y-[1px] hover:shadow-[0_4px_18px_-8px_rgba(11,29,52,0.18)]'
      }`}
    >
      {featured && (
        <div className="bg-navy text-gold px-4 py-1.5 font-archivo font-black text-[0.62rem] uppercase tracking-[0.26em] flex items-center gap-2">
          <IconBookmark />
          Editor's pick
          <span className="ml-auto text-gold/60 normal-case tracking-normal font-franklin italic text-[0.7rem]">
            Highest-scored dispatch
          </span>
        </div>
      )}
      <div className={`px-[18px] pt-3.5 pb-3 ${featured ? 'sm:px-6 sm:pt-5' : ''}`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full ${catCls}`}>
            {post.category}
          </span>
          <span className="text-[0.7rem] text-gray font-archivo">{formatTimeAgo(post.created_at)}</span>
          {post.is_sos && !post.sos_resolved && (
            <span className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-wider py-[3px] px-2 rounded-full bg-danger text-white flex items-center gap-1">
              <IconSiren /> SOS
            </span>
          )}
        </div>
        <h3
          className={`${featured ? 'font-editorial italic' : 'font-archivo font-bold'} leading-tight tracking-tight mb-1 text-navy`}
          style={featured ? { fontSize: 'clamp(1.3rem, 2.4vw, 1.8rem)', fontWeight: 500 } : { fontSize: '1.05rem' }}
        >
          {post.title}
        </h3>
        {post.body && (
          <p className={`text-gray leading-relaxed ${featured ? 'text-[0.9rem] line-clamp-3' : 'text-[0.82rem] line-clamp-2'}`}>
            {post.body}
          </p>
        )}
      </div>
      {post.image_url && (
        <div className="bg-black/80 overflow-hidden">
          <img src={post.image_url} alt="" loading="lazy" decoding="async" className="w-full max-h-[340px] object-contain mx-auto" />
        </div>
      )}
      <div className="px-[18px] py-2.5 border-t border-divider flex items-center gap-3 text-[0.72rem] text-gray font-archivo font-bold">
        <span className="flex items-center gap-1.5 text-gold">
          <IconCaretUp filled />
          <span className="text-ink">{score}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <IconChat />
          <span>{post.comment_count ?? 0}</span>
        </span>
      </div>
    </Link>
  )
}

/* =========================================================================
 * Sidebar atoms.
 * ========================================================================= */
function StatLedger({ karma, postCount, streak, totalVotes }) {
  // Typewriter/ledger-style stats. Monospace-feeling through tracking + uppercase.
  const rows = [
    { label: 'Karma', value: karma },
    { label: 'Dispatches', value: postCount },
    { label: 'Streak', value: `${streak}d` },
    { label: 'Total upvotes', value: totalVotes },
  ]
  return (
    <div className="bg-card border border-lightgray">
      <div className="bg-navy text-gold px-4 py-3 font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest">
        The ledger
      </div>
      <ul className="divide-y divide-[#EAE7E0]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between px-4 py-3">
            <span className="font-archivo font-extrabold text-[0.62rem] uppercase tracking-[0.22em] text-gray">
              {r.label}
            </span>
            <span
              className="font-editorial text-navy"
              style={{ fontSize: '1.35rem', fontWeight: 600, fontVariationSettings: '"opsz" 60' }}
            >
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SideStat({ label, value, border = '' }) {
  return (
    <div className={`px-4 py-3 text-center ${border}`}>
      <div className="font-archivo font-black text-[1.2rem] text-navy leading-none">{value}</div>
      <div className="text-[0.58rem] uppercase tracking-widest text-gray font-archivo font-extrabold mt-1">{label}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="font-archivo text-[0.62rem] font-bold uppercase tracking-wide text-gray">{label}</div>
      <div className="text-[0.88rem] font-semibold mt-[2px] break-words">{value}</div>
    </div>
  )
}

function SiteAnalyticsCard({ siteStats }) {
  return (
    <div className="bg-card border border-lightgray overflow-hidden">
      <div className="bg-navy text-gold px-4 py-3 font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest flex items-center justify-between">
        <span>Site analytics</span>
        <Link to="/stats" className="text-[0.58rem] text-gold/70 hover:text-gold no-underline normal-case tracking-normal">
          Full dashboard →
        </Link>
      </div>
      {siteStats ? (
        <div className="grid grid-cols-2">
          <SideStat label="Students" value={siteStats.users ?? 0} />
          <SideStat label="Posts" value={siteStats.posts ?? 0} border="border-l" />
          <SideStat label="Comments" value={siteStats.comments ?? 0} border="border-t" />
          <SideStat label="Posts / 24h" value={siteStats.posts_last_24h ?? 0} border="border-t border-l" />
          <SideStat label="Posts / week" value={siteStats.posts_last_7d ?? 0} border="border-t" />
          <SideStat label="Campus events" value={siteStats.synced_campus_events ?? 0} border="border-t border-l" />
          <SideStat label="SOS requests" value={siteStats.sos_posts ?? 0} border="border-t" />
          <SideStat
            label="SOS resolved"
            value={siteStats.sos_resolved_pct == null ? '-' : `${siteStats.sos_resolved_pct}%`}
            border="border-t border-l"
          />
        </div>
      ) : (
        <div className="px-4 py-5 text-[0.8rem] text-gray">Loading live numbers…</div>
      )}
    </div>
  )
}

/* =========================================================================
 * Page.
 * ========================================================================= */
function Profile() {
  const { id } = useParams()
  const { user: currentUser, setUser: setAuthUser } = useAuth()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('writings')
  const [showEdit, setShowEdit] = useState(false)
  const [siteStats, setSiteStats] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [bannerUrl, setBannerUrl] = useState(null)
  const [imgError, setImgError] = useState(null)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [bannerSaving, setBannerSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      apiFetch(`/api/users/${id}`),
      apiFetch(`/api/posts?author_id=${id}`),
    ])
      .then(([userData, postsData]) => {
        if (cancelled) return
        setUser(userData)
        setPosts(postsData)
        setAvatarUrl(readImage(userData.id, 'avatar'))
        setBannerUrl(readImage(userData.id, 'banner'))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Failed to load profile')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    apiFetch('/api/stats')
      .then((data) => { if (!cancelled) setSiteStats(data) })
      .catch(() => { /* non-fatal */ })

    return () => { cancelled = true }
  }, [id])

  if (loading) return <ProfileSkeleton />
  if (error || !user) {
    return (
      <div className="min-h-screen bg-[#F7F1E3] flex items-center justify-center">
        <p className="text-gray font-editorial italic">{error || 'User not found'}</p>
      </div>
    )
  }

  const palette = getPalette(user)
  const isSelf = currentUser?.id === user.id
  const totalVotes = posts.reduce((sum, p) => sum + ((p.upvotes ?? 0) - (p.downvotes ?? 0)), 0)

  // Editor's pick = highest-scored post. Keep it only if it actually scored.
  const rankedPosts = [...posts].sort((a, b) => {
    const sa = (a.upvotes ?? 0) - (a.downvotes ?? 0)
    const sb = (b.upvotes ?? 0) - (b.downvotes ?? 0)
    return sb - sa
  })
  const pinnedPost = rankedPosts[0] && ((rankedPosts[0].upvotes ?? 0) - (rankedPosts[0].downvotes ?? 0)) > 0
    ? rankedPosts[0] : null
  const remainingPosts = pinnedPost ? posts.filter((p) => p.id !== pinnedPost.id) : posts

  const handlePickAvatar = async (file) => {
    if (!isSelf) return
    setAvatarSaving(true)
    setImgError(null)
    try {
      const dataUrl = await readFileAsDataURL(file)
      writeImage(user.id, 'avatar', dataUrl)
      setAvatarUrl(dataUrl)
      // TODO backend: POST /api/users/me/avatar multipart, replace url with server url.
    } catch (e) {
      setImgError(e.message || 'Could not read image')
    } finally {
      setAvatarSaving(false)
    }
  }
  const handlePickBanner = async (file) => {
    if (!isSelf) return
    setBannerSaving(true)
    setImgError(null)
    try {
      const dataUrl = await readFileAsDataURL(file, 2_000_000)
      writeImage(user.id, 'banner', dataUrl)
      setBannerUrl(dataUrl)
    } catch (e) {
      setImgError(e.message || 'Could not read image')
    } finally {
      setBannerSaving(false)
    }
  }
  const handleClearAvatar = () => {
    if (!isSelf) return
    writeImage(user.id, 'avatar', null)
    setAvatarUrl(null)
  }
  const handleClearBanner = () => {
    if (!isSelf) return
    writeImage(user.id, 'banner', null)
    setBannerUrl(null)
  }

  const tabs = [
    { key: 'writings', label: 'Writings', count: posts.length },
    { key: 'activity', label: 'Activity' },
    { key: 'comments', label: 'Comments' },
    { key: 'dossier', label: 'Dossier' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F1E3] relative">
      <PaperGrain />

      <div className="relative z-[2]">
        <FolioBar user={user} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <BannerZone
            palette={palette}
            bannerUrl={bannerUrl}
            canEdit={isSelf}
            onPick={handlePickBanner}
            onClear={handleClearBanner}
            saving={bannerSaving}
          />
        </motion.div>

        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Nameplate
            user={user}
            palette={palette}
            avatarUrl={avatarUrl}
            isSelf={isSelf}
            onEdit={() => setShowEdit(true)}
            onPickAvatar={handlePickAvatar}
            onClearAvatar={handleClearAvatar}
            avatarSaving={avatarSaving}
          />
        </motion.div>

        {imgError && (
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-3">
            <div className="bg-danger-bg border border-danger-border text-danger px-3 py-2 text-[0.82rem] font-archivo font-bold">
              {imgError}
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <BioQuote user={user} isSelf={isSelf} onEdit={() => setShowEdit(true)} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.28 }}
        >
          <BeatsRow posts={posts} />
        </motion.div>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-16 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
          {/* MAIN COLUMN */}
          <main>
            {isSelf && currentUser?.role === 'admin' && (
              <div className="mb-5">
                <AdminDashboard />
              </div>
            )}

            {/* Tabs */}
            <nav aria-label="Profile sections" className="flex gap-0 border-b-[2px] border-navy mb-5 overflow-x-auto">
              {tabs.map((t) => {
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`relative font-archivo text-[0.72rem] font-extrabold uppercase tracking-[0.22em] py-3 px-5 cursor-pointer transition-all bg-transparent border-none whitespace-nowrap ${
                      active ? 'text-navy' : 'text-gray hover:text-ink'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {t.label}
                    {typeof t.count === 'number' && (
                      <span className={`ml-1.5 font-franklin normal-case tracking-normal text-[0.72rem] ${active ? 'text-gold' : 'text-gray/70'}`}>
                        {t.count}
                      </span>
                    )}
                    {active && (
                      <motion.div
                        layoutId="profile-tab-underline"
                        className="absolute left-0 right-0 bottom-[-2px] h-[3px] bg-gold"
                        transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                      />
                    )}
                  </button>
                )
              })}
            </nav>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                {tab === 'writings' && (
                  posts.length === 0 ? (
                    <EmptyPanel
                      title={isSelf ? 'No dispatches yet' : `${user.name} hasn't posted`}
                      body={isSelf
                        ? "Your editorial voice, once you start writing. Head to the feed and file your first piece."
                        : 'Nothing on the record for now. Come back after their next post.'}
                    />
                  ) : (
                    <div className="space-y-3">
                      {pinnedPost && <PostCard post={pinnedPost} featured />}
                      {remainingPosts.map((p) => <PostCard key={p.id} post={p} />)}
                    </div>
                  )
                )}

                {tab === 'activity' && <ActivityRibbon posts={posts} />}

                {tab === 'comments' && (
                  <EmptyPanel
                    title="The correspondence desk"
                    body={`We'll publish every comment ${isSelf ? 'you' : user.name} has written here. Coming soon — a full trail with links back to the source post.`}
                  />
                )}

                {tab === 'dossier' && (
                  <div className="bg-card border border-lightgray p-6 md:p-8">
                    <h2 className="font-editorial text-navy italic mb-5" style={{ fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)', fontWeight: 500 }}>
                      The dossier
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-[0.9rem]">
                      <InfoRow label="Full name" value={user.name || '-'} />
                      <InfoRow label="Email" value={user.email || '-'} />
                      <InfoRow label="Major" value={user.major || '-'} />
                      <InfoRow label="Class of" value={user.graduation_year || '-'} />
                      <InfoRow label="Role on BearBoard" value={(user.role || 'student').charAt(0).toUpperCase() + (user.role || 'student').slice(1)} />
                      <InfoRow label="Joined" value={formatJoinDate(user.created_at) || '-'} />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* SIDEBAR */}
          <aside className="space-y-5">
            <StatLedger
              karma={user.karma ?? 0}
              postCount={posts.length}
              streak={user.streak_count ?? 0}
              totalVotes={totalVotes}
            />

            <ActivityRibbon posts={posts} />

            <div className="bg-card border border-lightgray overflow-hidden">
              <div className="bg-navy text-gold px-4 py-3 font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest">
                Colophon
              </div>
              <div className="px-4 py-4 font-editorial text-navy text-[0.92rem] leading-relaxed italic">
                Set in Fraunces &amp; Archivo Black. Printed on recycled cream stock at the
                BearBoard atelier, 24 hours a day.
              </div>
              <div className="px-4 py-3 border-t border-[#EAE7E0] text-[0.72rem] text-gray flex items-center gap-1.5">
                <IconCalendar />
                <span>Joined {formatJoinDate(user.created_at) || 'recently'}</span>
              </div>
            </div>

            <SiteAnalyticsCard siteStats={siteStats} />

            <div className="bg-card border border-lightgray overflow-hidden">
              <div className="bg-navy text-gold px-4 py-3 font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest">
                House rules
              </div>
              <ol className="px-4 py-3 space-y-2.5 text-[0.78rem] text-ink/80 list-decimal pl-7">
                <li>Be kind. Morgan students are your classmates first.</li>
                <li>No spam, self-promo, or off-campus resale.</li>
                <li>Use Anonymous for sensitive topics.</li>
                <li>SOS posts are for real help requests only.</li>
                <li>No harassment, doxxing, or hate speech.</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>

      <EditProfileModal
        open={showEdit}
        user={user}
        onClose={() => setShowEdit(false)}
        onSaved={(updated) => {
          setUser(updated)
          if (isSelf && setAuthUser) setAuthUser(updated)
        }}
      />
    </div>
  )
}

/* =========================================================================
 * Empty-state panel used for tabs without data.
 * ========================================================================= */
function EmptyPanel({ title, body }) {
  return (
    <div className="bg-card border border-lightgray px-6 py-10 md:px-10 md:py-14 text-center relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, #0B1D34 0 1px, transparent 1px 14px)' }}
      />
      <div
        className="font-editorial italic text-navy mx-auto"
        style={{ fontSize: 'clamp(1.3rem, 2.4vw, 1.9rem)', fontWeight: 500 }}
      >
        {title}
      </div>
      <div className="text-gray text-[0.88rem] leading-relaxed max-w-[420px] mx-auto mt-2 font-franklin">
        {body}
      </div>
    </div>
  )
}

export default Profile
