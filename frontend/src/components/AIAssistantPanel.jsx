import { useEffect, useRef, useState } from 'react'
import { API_URL } from '../api/client'

// Two-tab assistant pinned under the post body.
// - Summarize: streams Gemini tokens via SSE so the TL;DR appears live as it generates.
// - Suggest next steps: still a JSON POST against /api/ai/insights, but uses raw fetch
//   (no apiFetch cache) so a single bad request can't poison subsequent clicks.
function AIAssistantPanel({ postId, isAuthed }) {
  const [activeTab, setActiveTab] = useState(null) // 'summary' | 'insights' | null
  const [streamText, setStreamText] = useState('')
  const [streamProvider, setStreamProvider] = useState(null)
  const [streamKeyPoints, setStreamKeyPoints] = useState([])
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => () => { if (abortRef.current) abortRef.current.abort() }, [])

  const runSummary = async () => {
    if (!isAuthed) {
      setError('Log in to use the AI assistant.')
      setActiveTab('summary')
      return
    }
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    setActiveTab('summary')
    setLoading(true)
    setStreamText('')
    setStreamProvider(null)
    setStreamKeyPoints([])

    const token = localStorage.getItem('bearboard_token') || ''
    const url = `${API_URL}/api/ai/summarize/stream?post_id=${encodeURIComponent(postId)}&token=${encodeURIComponent(token)}`

    try {
      const resp = await fetch(url, { signal: ctrl.signal })
      if (!resp.ok || !resp.body) {
        throw new Error(`stream failed (${resp.status})`)
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // SSE frames are separated by blank lines
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const lines = frame.split('\n')
          let event = 'message'
          let dataLine = ''
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLine += line.slice(5).trim()
          }
          if (!dataLine) continue
          let payload = {}
          try { payload = JSON.parse(dataLine) } catch { continue }
          if (event === 'provider') setStreamProvider(payload.provider)
          else if (event === 'delta') setStreamText((t) => t + (payload.text || ''))
          else if (event === 'keypoint') setStreamKeyPoints((kp) => [...kp, payload.text])
          else if (event === 'error') setError(payload.detail || 'AI provider error')
          else if (event === 'done') { /* close handled below */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Stream failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const runInsights = async () => {
    if (!isAuthed) {
      setError('Log in to use the AI assistant.')
      setActiveTab('insights')
      return
    }
    setError(null)
    setActiveTab('insights')
    setLoading(true)
    setInsights(null)
    try {
      const token = localStorage.getItem('bearboard_token') || ''
      const resp = await fetch(`${API_URL}/api/ai/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ post_id: postId }),
      })
      if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(resp.status === 429 ? 'Too many AI requests — slow down a sec.' : (txt || `failed (${resp.status})`))
      }
      const data = await resp.json()
      setInsights(data)
    } catch (err) {
      setError(err.message || 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  const showSummaryPanel = activeTab === 'summary'
  const showInsightsPanel = activeTab === 'insights'

  return (
    <section
      className="mt-6 bg-card border border-lightgray border-l-[3px] border-l-gold"
      aria-labelledby="ai-assistant-heading"
    >
      <header className="px-5 sm:px-6 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            id="ai-assistant-heading"
            className="text-2xs font-archivo font-extrabold uppercase tracking-[0.24em] text-gray"
          >
            BearBoard Assistant
          </span>
          <span aria-hidden className="h-px w-8 bg-lightgray" />
          <span className="text-2xs font-archivo uppercase tracking-wider text-gray/80">
            powered by Gemini
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runSummary}
            disabled={loading}
            className={`px-3 py-2 min-h-[36px] font-archivo text-mini font-extrabold uppercase tracking-[0.14em] border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              showSummaryPanel
                ? 'bg-navy text-gold border-navy'
                : 'bg-offwhite text-ink border-lightgray hover:bg-card hover:border-navy'
            }`}
            aria-pressed={showSummaryPanel}
          >
            {loading && showSummaryPanel ? 'Summarizing…' : 'Summarize thread'}
          </button>
          <button
            type="button"
            onClick={runInsights}
            disabled={loading}
            className={`px-3 py-2 min-h-[36px] font-archivo text-mini font-extrabold uppercase tracking-[0.14em] border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              showInsightsPanel
                ? 'bg-navy text-gold border-navy'
                : 'bg-offwhite text-ink border-lightgray hover:bg-card hover:border-navy'
            }`}
            aria-pressed={showInsightsPanel}
          >
            {loading && showInsightsPanel ? 'Thinking…' : 'Suggest next steps'}
          </button>
        </div>
      </header>

      {(showSummaryPanel || showInsightsPanel) && (
        <div className="px-5 sm:px-6 pb-5 pt-1 border-t border-lightgray">
          {error && (
            <div role="alert" className="mt-3 text-mini text-danger font-archivo font-bold">
              {error}
            </div>
          )}

          {showSummaryPanel && (streamText || streamProvider) && !error && (
            <div className="mt-3">
              {streamProvider && <ProviderBadge provider={streamProvider} />}
              <p className="mt-2 font-prose text-[1rem] text-ink leading-[1.55] whitespace-pre-wrap">
                {streamText || (loading ? '' : '(no summary)')}
                {loading && <span className="inline-block w-2 h-4 align-middle bg-gold/60 ml-1 animate-pulse" />}
              </p>
              {streamKeyPoints.length > 0 && (
                <ul className="mt-3 list-disc pl-5 space-y-1.5 font-prose text-[0.95rem] text-ink/90">
                  {streamKeyPoints.map((p, i) => (<li key={i}>{p}</li>))}
                </ul>
              )}
            </div>
          )}

          {showInsightsPanel && insights && !loading && !error && (
            <div className="mt-3">
              <ProviderBadge provider={insights.provider} />
              <p className="mt-2 font-editorial font-black text-[1.15rem] text-ink leading-snug">
                {insights.headline}
              </p>
              {insights.guidance?.length > 0 && (
                <ol className="mt-3 list-decimal pl-5 space-y-1.5 font-prose text-[0.95rem] text-ink/90">
                  {insights.guidance.map((g, i) => (<li key={i}>{g}</li>))}
                </ol>
              )}
              {insights.resources?.length > 0 && (
                <div className="mt-4">
                  <div className="text-2xs font-archivo font-extrabold uppercase tracking-[0.22em] text-gray mb-1.5">
                    Worth checking
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {insights.resources.map((r, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-1 text-2xs font-archivo font-bold uppercase tracking-wider bg-offwhite border border-lightgray text-ink"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {loading && !streamText && (
            <p className="mt-3 text-mini text-gray font-archivo uppercase tracking-wider">
              Asking the assistant…
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function ProviderBadge({ provider }) {
  const label =
    provider === 'llm' ? 'AI'
      : provider === 'heuristic' ? 'Fallback (no LLM key)'
      : provider === 'noop' ? 'Empty input'
      : provider || 'AI'
  const tone = provider === 'llm'
    ? 'bg-navy text-gold'
    : 'bg-offwhite text-ink border border-lightgray'
  return (
    <span className={`inline-block px-2 py-[3px] text-2xs font-archivo font-extrabold uppercase tracking-[0.18em] ${tone}`}>
      {label}
    </span>
  )
}

export default AIAssistantPanel
