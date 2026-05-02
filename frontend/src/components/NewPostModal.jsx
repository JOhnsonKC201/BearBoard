import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { FLAIRS, flairSlug } from '../utils/avatar'
import ImageUploader from './ImageUploader'
import EmojiPickerButton, { insertAtCursor } from './EmojiPickerButton'

// Picker labels. Order mirrors FLAIRS so the UI matches the feed filter rail.
const CATEGORIES = FLAIRS.map((f) => f.label)
const LISTING_CATEGORIES = new Set(['Housing', 'Swap'])
const TITLE_MAX = 200
const BODY_MAX = 5000

function NewPostModal({ open, onClose, onCreated, preset }) {
  const { isAuthed, user } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState(preset?.category || 'General')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [price, setPrice] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isSos, setIsSos] = useState(false)
  // Per-spec: anonymity is its own toggle, not a category. Defaults OFF on
  // every modal open so the user must opt in each time — never carry the
  // last submission's choice into a fresh draft.
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const titleInputRef = useRef(null)
  const bodyRef = useRef(null)

  // Esc-to-close + lock body scroll while the modal is open. Also autofocus
  // the title field so keyboard users can start typing immediately.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = setTimeout(() => titleInputRef.current?.focus(), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      clearTimeout(focusTimer)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setTitle('')
      setBody(preset?.body || '')
      setCategory(preset?.category || 'General')
      setEventDate('')
      setEventTime('')
      setPrice('')
      setContactInfo('')
      setImageUrl('')
      setIsSos(false)
      setIsAnonymous(false)
      setErrors({})
      setSubmitError(null)
      setSubmitting(false)
      setSuccess(false)
    } else {
      if (preset?.category) setCategory(preset.category)
      if (preset?.body) setBody(preset.body)
    }
  }, [open, preset])

  const isEvent = category === 'Events'
  const isListing = LISTING_CATEGORIES.has(category)

  const validate = () => {
    const next = {}
    if (!title.trim()) next.title = 'A headline is required'
    else if (title.trim().length > TITLE_MAX) next.title = `Headline must be ${TITLE_MAX} characters or less`
    if (!body.trim()) next.body = 'The story needs a body'
    else if (body.trim().length > BODY_MAX) next.body = `Body must be ${BODY_MAX} characters or less`
    if (!CATEGORIES.includes(category)) next.category = 'Pick a desk for this story'
    if (isEvent) {
      if (!eventDate) next.eventDate = 'Event date is required'
      if (!eventTime) next.eventTime = 'Event time is required'
    }
    if (isListing && !contactInfo.trim()) {
      next.contactInfo = 'Add how readers should reach you'
    }
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    if (!isAuthed) {
      setSubmitError('You must be signed in to file a story.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        category: flairSlug(category),
        is_sos: isSos,
        is_anonymous: isAnonymous,
      }
      if (isEvent) {
        payload.event_date = eventDate
        payload.event_time = eventTime
      }
      if (isListing) {
        if (price.trim()) payload.price = price.trim()
        payload.contact_info = contactInfo.trim()
      }
      if (imageUrl.trim()) payload.image_url = imageUrl.trim()
      const post = await apiFetch('/api/posts/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccess(true)
      if (onCreated) onCreated(post)
    } catch (err) {
      if (err.status === 401) {
        setSubmitError('You must be logged in to publish.')
      } else {
        setSubmitError(err.message || 'Failed to publish')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Live preview byline strings — match the post-detail header so the
  // student sees roughly what their story will look like in the feed.
  const bylineName = isAnonymous ? 'Anonymous' : (user?.name || 'You')
  const previewHasContent = title.trim() || body.trim()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-navy/70 z-[200] flex items-center justify-center px-3"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="bg-card w-full max-w-[960px] max-h-[100dvh] sm:max-h-[94vh] flex flex-col overflow-hidden border border-lightgray shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          >

            {/* MASTHEAD — broadsheet-style header bar */}
            <div className="bg-navy text-white px-5 sm:px-7 py-4 flex items-start justify-between gap-3 shrink-0 border-b-[3px] border-gold">
              <div>
                <div className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-gold">
                  Bearboard · Newsroom
                </div>
                <h3 className="font-editorial font-black italic text-[1.45rem] sm:text-[1.7rem] leading-none tracking-tight mt-1.5">
                  File a story
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-white/65 hover:text-white text-[1.4rem] leading-none cursor-pointer bg-transparent border-none p-1 -mr-1 transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {success ? (
              <div className="px-7 py-12 text-center">
                <div className="font-editorial italic font-black text-gold text-[3rem] leading-none mb-2">✓</div>
                <div className="font-editorial italic font-black text-[1.6rem] mb-1">Off to print.</div>
                <div className="text-mini text-gray font-archivo uppercase tracking-wider mb-6">Your story is now live in the feed.</div>
                <div className="flex justify-center gap-2">
                  <button onClick={onClose}
                    className="bg-navy text-white border-none py-2.5 px-5 font-archivo text-mini font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#0a182b] transition-colors">
                    Done
                  </button>
                  <button onClick={() => setSuccess(false)}
                    className="bg-gold text-navy border-none py-2.5 px-5 font-archivo text-mini font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors">
                    File another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] min-h-0">

                  {/* LEFT — the form */}
                  <div className="overflow-y-auto px-5 sm:px-7 py-5 lg:border-r border-divider">

                    <FormSection title="The headline" first>
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={submitting}
                        maxLength={TITLE_MAX + 50}
                        className="w-full border border-lightgray bg-white px-3 py-2.5 text-[1rem] font-franklin focus:border-navy focus:outline-none"
                        placeholder="Lead with the headline"
                      />
                      <div className="flex items-center justify-between mt-1.5">
                        {errors.title
                          ? <span className="text-mini text-danger font-archivo font-bold">{errors.title}</span>
                          : <span className="text-2xs text-gray font-archivo">A good headline names the thing in 8 words or less.</span>}
                        <CharCount value={title} max={TITLE_MAX} />
                      </div>
                    </FormSection>

                    <FormSection title="The desk">
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map((cat) => (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => setCategory(cat)}
                            disabled={submitting}
                            className={`font-archivo text-[0.68rem] font-extrabold uppercase tracking-wider py-[6px] px-2.5 border transition-colors ${
                              category === cat
                                ? 'bg-navy text-gold border-navy'
                                : 'bg-card text-ink border-lightgray hover:border-navy'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      {errors.category && <div className="text-mini text-danger font-archivo font-bold mt-2">{errors.category}</div>}
                    </FormSection>

                    {isEvent && (
                      <FormSection title="When it runs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Sublabel>Date</Sublabel>
                            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={submitting}
                              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none" />
                            {errors.eventDate && <div className="text-mini text-danger font-archivo font-bold mt-1">{errors.eventDate}</div>}
                          </div>
                          <div>
                            <Sublabel>Time</Sublabel>
                            <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} disabled={submitting}
                              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none" />
                            {errors.eventTime && <div className="text-mini text-danger font-archivo font-bold mt-1">{errors.eventTime}</div>}
                          </div>
                        </div>
                      </FormSection>
                    )}

                    {isListing && (
                      <FormSection title="The classifieds">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Sublabel>{category === 'Swap' ? 'Price / Offer' : 'Rent / Budget'}</Sublabel>
                            <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} disabled={submitting}
                              placeholder={category === 'Swap' ? '$25, Free, OBO' : '$600/mo'}
                              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none" />
                          </div>
                          <div>
                            <Sublabel>Contact</Sublabel>
                            <input type="text" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} disabled={submitting}
                              placeholder="@discord, email, GroupMe…"
                              className="w-full border border-lightgray bg-white px-3 py-2 text-[0.92rem] font-franklin focus:border-navy focus:outline-none" />
                            {errors.contactInfo && <div className="text-mini text-danger font-archivo font-bold mt-1">{errors.contactInfo}</div>}
                          </div>
                        </div>
                      </FormSection>
                    )}

                    <FormSection title="The story">
                      <textarea
                        ref={bodyRef}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        disabled={submitting}
                        rows={8}
                        maxLength={BODY_MAX + 200}
                        className="w-full border border-lightgray bg-white px-3 py-2.5 text-[0.95rem] font-prose leading-[1.55] resize-y focus:border-navy focus:outline-none"
                        placeholder="Write the body of your story. The first paragraph runs as a pull quote on long posts."
                      />
                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <EmojiPickerButton align="left" disabled={submitting}
                          onPick={(e) => insertAtCursor(bodyRef, body, setBody, e)} />
                        <div className="flex items-center gap-3">
                          {errors.body && <span className="text-mini text-danger font-archivo font-bold">{errors.body}</span>}
                          <CharCount value={body} max={BODY_MAX} />
                        </div>
                      </div>
                    </FormSection>

                    <FormSection title="The art">
                      <ImageUploader value={imageUrl} onChange={setImageUrl} disabled={submitting} />
                    </FormSection>

                    <FormSection title="The flags">
                      <Flag
                        accent="navy"
                        icon="◐"
                        title="Run anonymously"
                        body={(
                          <>
                            Hides your name and avatar from other students. Moderators can still see the author when investigating rule violations.{' '}
                            <a href="/anonymity" target="_blank" rel="noopener noreferrer"
                              className="text-navy underline underline-offset-2 hover:text-gold"
                              onClick={(e) => e.stopPropagation()}>Anonymity guide</a>.
                          </>
                        )}
                        checked={isAnonymous}
                        onChange={setIsAnonymous}
                        disabled={submitting}
                      />
                      <Flag
                        accent="danger"
                        icon="!"
                        title="SOS — needs help fast"
                        body="Pins your story to the top of the feed and notifies students who share your major. Use it sparingly."
                        checked={isSos}
                        onChange={setIsSos}
                        disabled={submitting}
                      />
                    </FormSection>
                  </div>

                  {/* RIGHT — live preview pane (hidden on mobile so the form
                      gets the whole modal width) */}
                  <aside className="hidden lg:block bg-offwhite/70 px-6 py-5 overflow-y-auto">
                    <div className="font-archivo text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-gray border-b border-divider pb-2 mb-4 flex items-center justify-between">
                      <span>Live preview</span>
                      <span className="text-2xs">Front page</span>
                    </div>

                    <PreviewCard
                      hasContent={previewHasContent}
                      category={category}
                      title={title}
                      body={body}
                      bylineName={bylineName}
                      isAnonymous={isAnonymous}
                      isSos={isSos}
                      isEvent={isEvent}
                      eventDate={eventDate}
                      eventTime={eventTime}
                      price={price}
                      imageUrl={imageUrl}
                    />

                    <div className="text-2xs text-gray font-franklin italic mt-4 text-center">
                      A rough cut of how your story will read in the feed.
                    </div>
                  </aside>

                </div>

                {/* FOOTER — sticks below both columns */}
                <div className="shrink-0 border-t border-divider bg-card px-5 sm:px-7 py-3.5">
                  {submitError && (
                    <div className="bg-danger-bg text-danger px-3 py-2 text-mini font-archivo font-bold mb-2 border border-danger/40">
                      {submitError}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-2xs text-gray font-archivo uppercase tracking-wider">
                      Filed by <strong className="text-ink">{bylineName}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={onClose} disabled={submitting}
                        className="bg-transparent text-gray border border-lightgray min-h-[44px] py-2.5 px-4 font-archivo text-mini font-extrabold uppercase tracking-wide cursor-pointer hover:text-ink hover:border-gray transition-colors">
                        Discard
                      </button>
                      <button type="submit" disabled={submitting}
                        className="bg-gold text-navy border-none min-h-[44px] py-2.5 px-6 font-archivo text-mini font-extrabold uppercase tracking-wider cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                        {submitting ? 'Publishing…' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Sub-components — kept local to this file because they're only used by the
// editorial composer and have no obvious reuse elsewhere.
// ---------------------------------------------------------------------------

function FormSection({ title, children, first }) {
  return (
    <section className={first ? '' : 'mt-5 pt-5 border-t border-divider'}>
      <div className="font-archivo text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-gray mb-2">
        {title}
      </div>
      {children}
    </section>
  )
}

function Sublabel({ children }) {
  return (
    <div className="font-archivo text-[0.58rem] font-bold uppercase tracking-wider text-gray mb-1">
      {children}
    </div>
  )
}

function Flag({ accent, icon, title, body, checked, onChange, disabled }) {
  const tone = accent === 'danger' ? {
    border: 'border-danger/30 hover:border-danger/60',
    iconBg: 'bg-danger text-white',
    title: 'text-danger',
    accentClass: 'accent-danger',
  } : {
    border: 'border-lightgray hover:border-navy/40',
    iconBg: 'bg-navy text-gold',
    title: 'text-navy',
    accentClass: 'accent-navy',
  }
  return (
    <label className={`flex items-start gap-3 mb-2 last:mb-0 cursor-pointer select-none p-3 border ${tone.border} bg-card transition-colors`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled}
        className={`mt-[3px] ${tone.accentClass}`} />
      <span className={`w-6 h-6 rounded-full ${tone.iconBg} flex items-center justify-center font-archivo font-black text-[0.78rem] shrink-0`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`font-archivo font-extrabold text-[0.78rem] uppercase tracking-wider ${tone.title} block`}>
          {title}
        </span>
        <span className="block text-[0.78rem] text-ink/75 font-franklin mt-0.5 leading-snug">
          {body}
        </span>
      </span>
    </label>
  )
}

function CharCount({ value, max }) {
  const len = value.length
  const over = len > max
  return (
    <div className={`text-2xs text-right font-archivo tabular-nums ${over ? 'text-danger font-bold' : 'text-gray'}`}>
      {len} / {max}
    </div>
  )
}

// Live preview card — mirrors the broadsheet feel of the post detail page
// but at modal scale. Shows what the article will look like in the feed
// the moment the student hits Publish.
function PreviewCard({ hasContent, category, title, body, bylineName, isAnonymous, isSos, isEvent, eventDate, eventTime, price, imageUrl }) {
  if (!hasContent && !imageUrl) {
    return (
      <div className="border border-dashed border-lightgray bg-card px-5 py-10 text-center">
        <div className="font-editorial italic text-[1.15rem] text-gray leading-snug mb-1">“Empty page.”</div>
        <p className="text-2xs text-gray font-archivo uppercase tracking-wider">
          Start writing — your draft will preview here in real time.
        </p>
      </div>
    )
  }
  // Drop-cap on the first letter of long bodies, matching PostDetail.
  const trimmedBody = (body || '').trim()
  const longBody = trimmedBody.length > 180
  return (
    <article className="bg-card border border-lightgray border-l-[3px] border-l-gold p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-archivo text-[0.58rem] font-extrabold uppercase tracking-[0.22em] text-gray">
          {category}
        </span>
        {isSos && (
          <span className="font-archivo text-2xs font-extrabold uppercase tracking-wider py-[2px] px-1.5 bg-danger text-white">
            SOS
          </span>
        )}
        <span aria-hidden className="h-px flex-1 bg-lightgray" />
      </div>
      <h2 className="font-editorial font-black text-[1.4rem] leading-[1.15] tracking-tight m-0 text-ink">
        {title || <span className="text-gray italic font-normal">Your headline appears here.</span>}
      </h2>
      <div className="mt-2 text-2xs text-gray font-archivo uppercase tracking-wider">
        By <strong className="text-ink">{bylineName}</strong>
        {isEvent && eventDate ? <> · {eventDate}{eventTime ? ` at ${eventTime}` : ''}</> : null}
        {price && <> · {price}</>}
      </div>
      {imageUrl && (
        <div className="mt-3 border border-lightgray overflow-hidden">
          <img src={imageUrl} alt="" className="w-full max-h-[180px] object-cover" />
        </div>
      )}
      {trimmedBody && (
        <div className="mt-3 font-prose text-[0.95rem] text-ink/85 leading-[1.6] whitespace-pre-wrap">
          {longBody ? (
            <>
              <span className="float-left font-editorial font-black text-[2.2rem] leading-[0.85] mr-1.5 mt-1 text-navy">
                {trimmedBody.charAt(0)}
              </span>
              {trimmedBody.slice(1)}
            </>
          ) : trimmedBody}
        </div>
      )}
    </article>
  )
}

export default NewPostModal
