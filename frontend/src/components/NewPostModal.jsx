import { useEffect, useRef, useState } from 'react'
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
  const { isAuthed } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState(preset?.category || 'General')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [price, setPrice] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isSos, setIsSos] = useState(false)
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
      setErrors({})
      setSubmitError(null)
      setSubmitting(false)
      setSuccess(false)
    } else {
      // Apply preset every time the modal opens so a subsequent "Report
      // incident" click from the SafetyBox re-fills the preset state.
      if (preset?.category) setCategory(preset.category)
      if (preset?.body) setBody(preset.body)
    }
  }, [open, preset])

  const isEvent = category === 'Events'
  const isListing = LISTING_CATEGORIES.has(category)

  const validate = () => {
    const next = {}
    if (!title.trim()) next.title = 'Title is required'
    else if (title.trim().length > TITLE_MAX) next.title = `Title must be ${TITLE_MAX} characters or less`
    if (!body.trim()) next.body = 'Body is required'
    else if (body.trim().length > BODY_MAX) next.body = `Body must be ${BODY_MAX} characters or less`
    if (!CATEGORIES.includes(category)) next.category = 'Pick a valid category'
    if (isEvent) {
      if (!eventDate) next.eventDate = 'Event date is required'
      if (!eventTime) next.eventTime = 'Event time is required'
    }
    if (isListing && !contactInfo.trim()) {
      next.contactInfo = 'Add how people should reach you'
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
      setSubmitError('You must be signed in to post.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        category: flairSlug(category),
        is_sos: isSos,
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
      const post = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccess(true)
      if (onCreated) onCreated(post)
    } catch (err) {
      if (err.status === 401) {
        setSubmitError('You must be logged in to post.')
      } else {
        setSubmitError(err.message || 'Failed to create post')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-navy/60 z-[200] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="bg-card w-[90%] max-w-[600px] max-h-[85vh] overflow-y-auto border border-lightgray"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EAE7E0] bg-offwhite sticky top-0 z-[1]">
          <h3 className="font-archivo font-extrabold text-[1rem] uppercase tracking-tight">New Post</h3>
          <button
            onClick={onClose}
            className="ml-auto bg-transparent border-none text-[1.3rem] cursor-pointer text-gray hover:text-ink p-1"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {success ? (
          <div className="px-5 py-8 text-center">
            <div className="font-archivo font-black text-gold text-[2rem] mb-1">&#10003;</div>
            <div className="font-archivo font-extrabold text-[0.95rem] mb-2">Post created</div>
            <div className="text-[0.82rem] text-gray mb-5">Your post is now live in the feed.</div>
            <div className="flex justify-center gap-2">
              <button
                onClick={onClose}
                className="bg-navy text-white border-none py-2.5 px-5 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#0a182b] transition-colors"
              >
                Done
              </button>
              <button
                onClick={() => setSuccess(false)}
                className="bg-gold text-navy border-none py-2.5 px-5 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors"
              >
                Post Another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4">
            <Field label="Title" error={errors.title}>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                maxLength={TITLE_MAX + 50}
                className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy"
                placeholder="What's your post about?"
              />
              <CharCount value={title} max={TITLE_MAX} />
            </Field>

            <Field label="Category" error={errors.category}>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setCategory(cat)}
                    disabled={submitting}
                    className={`font-archivo text-[0.7rem] font-extrabold uppercase tracking-wider py-[7px] px-3 border transition-colors ${
                      category === cat
                        ? 'bg-navy text-gold border-navy'
                        : 'bg-white text-ink border-lightgray hover:border-navy'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {category === 'Anonymous' && (
                <div className="mt-2 bg-offwhite border-l-[3px] border-navy px-3 py-2 text-[0.75rem] leading-relaxed text-ink/85">
                  <strong className="font-archivo uppercase tracking-wider text-[0.62rem] text-navy">
                    Anonymous — you&apos;re covered
                  </strong>
                  <div className="mt-1">
                    Your name and avatar are hidden from other students. Moderators can
                    still see the author when investigating a rules violation.{' '}
                    <a
                      href="/anonymity"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-navy underline underline-offset-2 hover:text-gold"
                    >
                      Read the full anonymity guide
                    </a>
                    .
                  </div>
                </div>
              )}
            </Field>

            {isEvent && (
              <div className="grid grid-cols-2 gap-3 mb-1">
                <Field label="Event Date" error={errors.eventDate}>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    disabled={submitting}
                    className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none"
                  />
                </Field>
                <Field label="Event Time" error={errors.eventTime}>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    disabled={submitting}
                    className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none"
                  />
                </Field>
              </div>
            )}

            <Field label="Image (optional)" error={null}>
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                disabled={submitting}
              />
            </Field>

            {isListing && (
              <div className="grid grid-cols-2 gap-3 mb-1">
                <Field label={category === 'Swap' ? 'Price / Offer' : 'Rent / Budget'} error={null}>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={submitting}
                    placeholder={category === 'Swap' ? '$25, Free, OBO' : '$600/mo'}
                    className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none"
                  />
                </Field>
                <Field label="Contact" error={errors.contactInfo}>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    disabled={submitting}
                    placeholder="@discord, email, GroupMe…"
                    className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin focus:border-navy focus:outline-none"
                  />
                </Field>
              </div>
            )}

            <label className="flex items-start gap-2.5 mb-4 cursor-pointer select-none p-3 border border-lightgray bg-offwhite hover:border-[#8B1A1A]/40 transition-colors">
              <input
                type="checkbox"
                checked={isSos}
                onChange={(e) => setIsSos(e.target.checked)}
                disabled={submitting}
                className="mt-[3px] accent-[#8B1A1A]"
              />
              <span>
                <span className="font-archivo font-extrabold text-[0.78rem] text-[#8B1A1A] flex items-center gap-1.5">
                  <span aria-hidden="true">&#128680;</span> SOS: I need help fast
                </span>
                <span className="block text-[0.7rem] text-gray mt-[2px] leading-snug">
                  Pins your post to the top and notifies students in your major.
                </span>
              </span>
            </label>

            <Field label="Body" error={errors.body}>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={submitting}
                rows={6}
                maxLength={BODY_MAX + 200}
                className="w-full border border-lightgray bg-white px-3 py-2 text-[0.9rem] font-franklin resize-y focus:border-navy focus:outline-none"
                placeholder="Share the details…"
              />
              <div className="flex items-center justify-between gap-2 mt-1">
                <EmojiPickerButton
                  align="left"
                  disabled={submitting}
                  onPick={(e) => insertAtCursor(bodyRef, body, setBody, e)}
                />
                <CharCount value={body} max={BODY_MAX} />
              </div>
            </Field>

            {submitError && (
              <div className="bg-[#F5D5D0] text-[#8B1A1A] px-3 py-2 text-[0.8rem] mb-3 border border-[#E5B5B0]">
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAE7E0]">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="bg-transparent text-gray border border-lightgray py-2.5 px-4 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:text-ink hover:border-gray transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-gold text-navy border-none py-2.5 px-5 font-archivo text-[0.72rem] font-extrabold uppercase tracking-wide cursor-pointer hover:bg-[#E5A92E] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({ label, error, children }) {
  return (
    <div className="mb-4">
      <label className="font-archivo text-[0.62rem] font-extrabold uppercase tracking-wide text-gray block mb-1.5">
        {label}
      </label>
      {children}
      {error && <div className="text-[0.72rem] text-[#8B1A1A] mt-1 font-archivo font-bold">{error}</div>}
    </div>
  )
}

function CharCount({ value, max }) {
  const len = value.length
  const over = len > max
  return (
    <div className={`text-[0.65rem] mt-1 text-right font-franklin ${over ? 'text-[#8B1A1A]' : 'text-gray'}`}>
      {len} / {max}
    </div>
  )
}

export default NewPostModal
