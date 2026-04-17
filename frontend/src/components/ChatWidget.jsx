import { useState, useRef, useEffect } from 'react'

const CANNED = {
  'What events are coming up?':
    'This week:<br/><br/>\u2022 <b>Yard Fest 2026</b> \u2014 Apr 18, Main Yard, 12-8 PM<br/>\u2022 <b>Spring Career Fair</b> \u2014 Apr 22, Student Center, 10 AM-3 PM<br/>\u2022 <b>Hackathon Kickoff</b> \u2014 Apr 25, SCMNS 201, 6 PM',
  'Find me a study group for COSC 350':
    'Found one! <b>"Networking Gang"</b> for COSC 350 \u2014 12 members, meets Tue/Thu on library 3rd floor. They\'re doing networking layers and socket programming. Want me to add you?',
  "What's trending today?":
    'Top posts today:<br/><br/>1. <b>Yard Fest Weekend Plans</b> \u2014 89 upvotes<br/>2. <b>JPMorgan Internship</b> \u2014 64 upvotes<br/>3. <b>Spring Career Fair</b> \u2014 47 upvotes',
  'How do I create a post?':
    'Hit the <b>"+ New Post"</b> button on the right side. Pick a category, write your title and body, and post. For events, add a date/time so it shows on the calendar.',
}

const SUGGESTIONS = [
  'What events are coming up?',
  'Find me a study group for COSC 350',
  "What's trending today?",
  'How do I create a post?',
]

function ChatWidget() {
  const [open, setOpen] = useState(false)
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

  const addBotReply = (text) => {
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages((prev) => [...prev, { from: 'bot', text }])
    }, 1000)
  }

  const sendMessage = (text) => {
    if (!text.trim()) return
    setMessages((prev) => [...prev, { from: 'user', text }])
    setShowSuggestions(false)
    setInput('')

    const reply =
      CANNED[text] ||
      'Thanks for your message! Try asking about <b>events</b>, <b>study groups</b>, <b>trending posts</b>, or <b>how to use features</b>. The full AI version will be able to answer anything about campus life.'
    addBotReply(reply)
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
        className="fixed bottom-6 right-6 w-[54px] h-[54px] bg-navy rounded-full flex items-center justify-center cursor-pointer z-[150] hover:scale-105 transition-transform shadow-lg"
      >
        <span className="text-[1.3rem]">{open ? '\u2715' : '\uD83D\uDCAC'}</span>
        {badgeVisible && (
          <div className="absolute -top-[3px] -right-[3px] bg-gold text-navy font-archivo text-[0.58rem] font-extrabold w-[18px] h-[18px] flex items-center justify-center rounded-full">
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
              <div className="w-[30px] h-[30px] bg-gold text-navy rounded-full flex items-center justify-center font-archivo font-black text-[0.72rem]">
                B
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
                    dangerouslySetInnerHTML={{ __html: msg.text }}
                  />
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
