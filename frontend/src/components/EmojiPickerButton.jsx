import { useEffect, useRef, useState } from 'react'

// Curated emoji set. Small on purpose — keeps bundle <5 KB and renders
// instantly. Swap for `emoji-mart` later if full Slack parity (thousands of
// emoji, search, skin tones) is ever needed.
const GROUPS = [
  {
    key: 'smileys',
    label: 'Smileys',
    items: [
      '\u{1F600}', '\u{1F601}', '\u{1F602}', '\u{1F923}', '\u{1F60A}', '\u{1F60D}',
      '\u{1F970}', '\u{1F618}', '\u{1F60B}', '\u{1F61C}', '\u{1F92A}', '\u{1F60E}',
      '\u{1F929}', '\u{1F973}', '\u{1F914}', '\u{1F610}', '\u{1F611}', '\u{1F62C}',
      '\u{1F644}', '\u{1F60F}', '\u{1F622}', '\u{1F62D}', '\u{1F624}', '\u{1F620}',
      '\u{1F621}', '\u{1F92F}', '\u{1F631}', '\u{1F628}', '\u{1F630}', '\u{1F634}',
      '\u{1F924}', '\u{1F912}', '\u{1F927}', '\u{1F922}', '\u{1F975}', '\u{1F976}',
    ],
  },
  {
    key: 'gestures',
    label: 'Gestures',
    items: [
      '\u{1F44D}', '\u{1F44E}', '\u{1F44F}', '\u{1F64C}', '\u{1F450}', '\u{1F91D}',
      '\u{1F91E}', '\u{270C}\u{FE0F}', '\u{1F91F}', '\u{1F918}', '\u{1F44C}',
      '\u{1F919}', '\u{1F449}', '\u{1F448}', '\u{1F446}', '\u{1F447}', '\u{1F64F}',
      '\u{1F4AA}', '\u{1F590}\u{FE0F}', '\u{270B}', '\u{1F44B}',
    ],
  },
  {
    key: 'hearts',
    label: 'Hearts',
    items: [
      '\u{2764}\u{FE0F}', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}',
      '\u{1F49C}', '\u{1F90E}', '\u{1F5A4}', '\u{1F90D}', '\u{1F494}',
      '\u{2763}\u{FE0F}', '\u{1F495}', '\u{1F49E}', '\u{1F493}', '\u{1F497}',
      '\u{1F496}', '\u{1F498}', '\u{1F49D}',
    ],
  },
  {
    key: 'objects',
    label: 'Objects',
    items: [
      '\u{1F4F1}', '\u{1F4BB}', '\u{1F5A5}\u{FE0F}', '\u{2328}\u{FE0F}',
      '\u{1F5B1}\u{FE0F}', '\u{1F4BE}', '\u{1F4F7}', '\u{1F4F9}', '\u{1F3A5}',
      '\u{1F3AE}', '\u{1F3B9}', '\u{1F3A7}', '\u{1F3A4}', '\u{1F3B5}', '\u{1F4DA}',
      '\u{1F4D6}', '\u{270F}\u{FE0F}', '\u{1F4DD}', '\u{1F516}', '\u{1F4CC}',
      '\u{1F4CD}', '\u{1F517}', '\u{1F511}',
    ],
  },
  {
    key: 'food',
    label: 'Food',
    items: [
      '\u{1F355}', '\u{1F354}', '\u{1F32D}', '\u{1F32E}', '\u{1F32F}', '\u{1F957}',
      '\u{1F363}', '\u{1F35C}', '\u{1F35B}', '\u{1F35D}', '\u{1F950}', '\u{1F9C7}',
      '\u{1F95E}', '\u{1F369}', '\u{1F36A}', '\u{1F382}', '\u{1F370}', '\u{1F36B}',
      '\u{1F36D}', '\u{2615}', '\u{1F375}', '\u{1F37A}', '\u{1F377}', '\u{1F964}',
    ],
  },
  {
    key: 'activities',
    label: 'Fun',
    items: [
      '\u{1F389}', '\u{1F38A}', '\u{1F388}', '\u{1F381}', '\u{1F3C6}', '\u{1F3C5}',
      '\u{1F947}', '\u{1F948}', '\u{1F949}', '\u{26BD}', '\u{1F3C0}', '\u{1F3C8}',
      '\u{26BE}', '\u{1F3BE}', '\u{1F3D0}', '\u{1F3B1}', '\u{1F3B8}', '\u{1F3A8}',
      '\u{1F3AD}', '\u{1F3AC}', '\u{1F4F8}',
    ],
  },
  {
    key: 'symbols',
    label: 'Signals',
    items: [
      '\u{2705}', '\u{274C}', '\u{2B50}', '\u{2728}', '\u{1F4AF}', '\u{1F525}',
      '\u{26A1}', '\u{2600}\u{FE0F}', '\u{1F319}', '\u{1F308}', '\u{2757}',
      '\u{2753}', '\u{1F4A1}', '\u{1F680}', '\u{1F3AF}', '\u{1F514}', '\u{1F515}',
      '\u{1F4AC}', '\u{1F4AD}', '\u{1F4A4}',
    ],
  },
]

function EmojiPickerButton({ onPick, disabled, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(GROUPS[0].key)
  const wrapRef = useRef(null)

  // Close on outside click / Esc, mirroring standard popover behavior.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const activeGroup = GROUPS.find((g) => g.key === tab) || GROUPS[0]

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Insert emoji"
        aria-expanded={open}
        className="w-8 h-8 flex items-center justify-center bg-transparent border border-transparent hover:border-lightgray hover:bg-offwhite text-gray hover:text-ink rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[1rem] leading-none"
      >
        <span aria-hidden>&#128512;</span>
      </button>
      {open && (
        <div
          className={`absolute z-[210] top-full mt-1 ${align === 'left' ? 'left-0' : 'right-0'} w-[280px] bg-card border border-lightgray shadow-lg`}
          role="dialog"
          aria-label="Emoji picker"
        >
          <div className="flex border-b border-lightgray overflow-x-auto">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setTab(g.key)}
                className={`flex-1 min-w-[52px] text-2xs font-archivo font-extrabold uppercase tracking-wider py-2 px-1 bg-transparent border-none cursor-pointer transition-colors ${
                  tab === g.key ? 'text-navy bg-offwhite' : 'text-gray hover:text-ink'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[220px] overflow-y-auto">
            {activeGroup.items.map((e, i) => (
              <button
                key={`${tab}-${i}`}
                type="button"
                onClick={() => { onPick(e); setOpen(false) }}
                className="w-8 h-8 flex items-center justify-center bg-transparent border-none rounded hover:bg-offwhite cursor-pointer text-[1.15rem] leading-none"
                aria-label={`Insert ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default EmojiPickerButton

// Helper: inserts `emoji` at the cursor position of an uncontrolled textarea
// whose value is held in React state. Pass the textarea ref, the current
// value, and the state setter — returns nothing, moves the caret past the
// inserted emoji on the next frame.
export function insertAtCursor(textareaRef, value, setValue, emoji) {
  const ta = textareaRef?.current
  if (!ta || typeof ta.selectionStart !== 'number') {
    setValue((value || '') + emoji)
    return
  }
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const next = (value || '').slice(0, start) + emoji + (value || '').slice(end)
  setValue(next)
  requestAnimationFrame(() => {
    ta.focus()
    const pos = start + emoji.length
    try { ta.setSelectionRange(pos, pos) } catch { /* ignore */ }
  })
}
