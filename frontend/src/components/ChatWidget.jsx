import { useState, useRef, useEffect } from 'react'
import { apiFetch } from '../api/client'

const SUGGESTIONS = [
  'What events are coming up?',
  'Find me a study group for COSC 350',
  "What's trending today?",
  'How do I create a post?',
]

// Render the server's lightweight markdown (**bold**, newlines) as React
// nodes. Uses pure JSX so content is always escaped by React; never call
// dangerouslySetInnerHTML here.
function renderReply(raw) {
  const text = String(raw ?? '')
  const lines = text.split('\n')
  return lines.map((line, lineIdx) => {
    const parts = []
    const boldRe = /\*\*(.+?)\*\*/g
    let lastIndex = 0
    let match
    let partIdx = 0
    while ((match = boldRe.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`t-${lineIdx}-${partIdx++}`}>{line.slice(lastIndex, match.index)}</span>)
      }
      parts.push(<b key={`b-${lineIdx}-${partIdx++}`}>{match[1]}</b>)
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < line.length) {
      parts.push(<span key={`t-${lineIdx}-${partIdx++}`}>{line.slice(lastIndex)}</span>)
    }
    return (
      <span key={`line-${lineIdx}`}>
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    )
  })
}

function ChatWidget() {
  const [open, setOpen] = useState(false)
  // If /bear-mascot.png is present in public/, use the Morgan State bear logo.
  // Falls back to the bear emoji so the button never looks broken during dev.
  const [bearImgOk, setBearImgOk] = useState(true)
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: "Hey! I'm the BearBoard Assistant. Ask me about events, study groups, trending posts, or anything on the platform.",
    },
  ])
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [badgeVisible, setBadgeVisible] = useState(true)
  const msgsRef = useRef(null)

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight
    }
  }, [messages, typing])

  const sendMessage = async (text) => {
    if (!text.trim()) return
    setMessages((prev) => [...prev, { from: 'user', text }])
    setShowSuggestions(false)
    setInput('')
    setTyping(true)
    try {
      const data = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })
      setMessages((prev) => [...prev, { from: 'bot', text: data.reply || '' }])
    } catch (err) {
      setMessages((prev) => [...prev, {
        from: 'bot',
        text: err.message || "I'm having trouble reaching the server right now. Try again in a moment.",
      }])
    } finally {
      setTyping(false)
    }
  }

  const toggle = () => {
    setOpen(!open)
    if (!open) setBadgeVisible(false)
  }

  return (
    <>
      {/* Chat bubble */}
      <div
        onClick={toggle}
        className="fixed bottom-6 right-6 w-[56px] h-[56px] bg-navy rounded-full ring-2 ring-gold flex items-center justify-center cursor-pointer z-[150] hover:scale-105 transition-transform shadow-[0_6px_20px_-6px_rgba(11,29,52,0.5)]"
        aria-label={open ? 'Close chat' : 'Open BearBoard chat'}
      >
        {open ? (
          <span className="text-white text-[1.3rem] font-archivo font-black">&#10005;</span>
        ) : bearImgOk ? (
          <img
            src="/bear-mascot.png"
            alt=""
            onError={() => setBearImgOk(false)}
            className="w-[42px] h-[42px] object-contain"
          />
        ) : (
          <span className="text-[1.75rem] leading-none" aria-hidden="true">&#128059;</span>
        )}
        {badgeVisible && !open && (
          <div className="absolute -top-1 -right-1 bg-gold text-navy font-archivo text-[0.58rem] font-extrabold w-[20px] h-[20px] rounded-full flex items-center justify-center ring-2 ring-navy">
            1
          </div>
        )}
      </div>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-[84px] right-6 w-[360px] h-[480px] bg-card border border-lightgray z-[160] flex flex-col overflow-hidden rounded-2xl shadow-2xl max-[768px]:w-[calc(100%-16px)] max-[768px]:right-2 max-[768px]:h-[420px]">
          {/* Header */}
          <div className="bg-navy px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-[32px] h-[32px] bg-gold rounded-full flex items-center justify-center overflow-hidden shrink-0">
                {bearImgOk ? (
                  <img
                    src="/bear-mascot.png"
                    alt=""
                    onError={() => setBearImgOk(false)}
                    className="w-[28px] h-[28px] object-contain"
                  />
                ) : (
                  <span className="text-[1rem]" aria-hidden="true">&#128059;</span>
                )}
              </div>
              <div>
                <div className="text-white font-semibold text-[0.85rem]">BearBoard Assistant</div>
                <div className="text-white/45 text-[0.68rem] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#4CAF50] rounded-full inline-block" />
                  Online
                </div>
              </div>
            </div>
            <button onClick={toggle} className="bg-transparent border-none text-white/40 text-[1.2rem] cursor-pointer hover:text-white">
              &times;
            </button>
          </div>

          {/* Messages */}
          <div ref={msgsRef} className="flex-1 overflow-y-auto px-3.5 py-3.5 flex flex-col gap-3 bg-offwhite">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 max-w-[88%] ${
                  msg.from === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                }`}
              >
                <div
                  className={`w-[26px] h-[26px] rounded-full flex items-center justify-center font-archivo text-[0.6rem] font-extrabold shrink-0 ${
                    msg.from === 'bot' ? 'bg-navy text-gold' : 'bg-gold text-navy'
                  }`}
                >
                  {msg.from === 'bot' ? 'B' : 'JK'}
                </div>
                <div className="flex flex-col gap-[2px]">
                  <div
                    className={`px-[13px] py-2.5 text-[0.82rem] leading-relaxed ${
                      msg.from === 'bot'
                        ? 'bg-card border border-lightgray text-ink rounded-2xl rounded-tl-sm'
                        : 'bg-navy text-white rounded-2xl rounded-tr-sm'
                    }`}
                  >
                    {msg.from === 'bot' ? renderReply(msg.text) : msg.text}
                  </div>
                  <div className={`text-[0.6rem] text-gray px-1 ${msg.from === 'user' ? 'text-right' : ''}`}>
                    Just now
                  </div>
                </div>
              </div>
            ))}

            {/* Suggestions */}
            {showSuggestions && (
              <div className="flex flex-wrap gap-[5px] py-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="bg-card border border-lightgray px-2.5 py-[5px] text-[0.7rem] font-franklin font-medium text-navy cursor-pointer hover:bg-navy hover:text-white hover:border-navy transition-colors rounded-full"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {typing && (
              <div className="flex gap-2 self-start">
                <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-archivo text-[0.6rem] font-extrabold bg-navy text-gold shrink-0">
                  B
                </div>
                <div className="flex items-center gap-1 px-[13px] py-2 bg-card border border-lightgray rounded-2xl rounded-tl-sm">
                  <span className="w-[5px] h-[5px] bg-gray rounded-full" style={{ animation: 'bounce-dot 1.2s infinite' }} />
                  <span className="w-[5px] h-[5px] bg-gray rounded-full" style={{ animation: 'bounce-dot 1.2s infinite 0.15s' }} />
                  <span className="w-[5px] h-[5px] bg-gray rounded-full" style={{ animation: 'bounce-dot 1.2s infinite 0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-1.5 px-3 py-2.5 border-t border-lightgray">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask anything about BearBoard..."
              className="flex-1 border border-lightgray py-[9px] px-3.5 text-[0.82rem] font-franklin outline-none bg-offwhite focus:border-navy focus:bg-white placeholder:text-gray rounded-full"
            />
            <button
              onClick={() => sendMessage(input)}
              className="w-9 h-9 bg-gold text-navy border-none cursor-pointer text-[1rem] flex items-center justify-center hover:bg-[#E5A92E] transition-colors rounded-full"
            >
              &#10148;
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default ChatWidget
