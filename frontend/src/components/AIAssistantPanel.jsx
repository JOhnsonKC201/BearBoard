import { useState } from 'react'
import { apiFetch } from '../api/client'

// Two-button panel that calls /api/ai/summarize and /api/ai/insights for the
// current post. Lives between the article body and the comments section so the
// affordance reads as a tool you can pull on the post itself, not a footer.
//
// Both endpoints are auth-gated and rate-limited on the backend. They also
// return {provider: "heuristic"} when no LLM key is configured, which is a
// real result — surface it rather than treating it as a failure.
function AIAssistantPanel({ postId, isAuthed }) {
  const [activeTab, setActiveTab] = useState(null) // 'summary' | 'insights' | null
  const [summary, setSummary] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async (kind) => {
    if (!isAuthed) {
      setError('Log in to use the AI assistant.')
      setActiveTab(kind)
      return
    }
    setError(null)
    setLoading(true)
    setActiveTab(kind)
    try {
      const endpoint = kind === 'summary' ? '/api/ai/summarize' : '/api/ai/insights'
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ post_id: postId }),
        cache: false,
      })
      if (kind === 'summary') setSummary(data)
      else setInsights(data)
    } catch (err) {
      setError(err.status === 429 ? 'Too many AI requests — slow down a sec.' : (err.message || 'AI request failed'))
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
            onClick={() => run('summary')}
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
            onClick={() => run('insights')}
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

          {showSummaryPanel && summary && !loading && !error && (
            <div className="mt-3">
              <ProviderBadge provider={summary.provider} />
              <p className="mt-2 font-prose text-[1rem] text-ink leading-[1.55]">
                {summary.tldr}
              </p>
              {summary.key_points?.length > 0 && (
                <ul className="mt-3 list-disc pl-5 space-y-1.5 font-prose text-[0.95rem] text-ink/90">
                  {summary.key_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
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
                  {insights.guidance.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
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

          {loading && (
            <p className="mt-3 text-mini text-gray font-archivo uppercase tracking-wider">
              Asking the assistant…
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// Tiny pill that names where the answer came from. Heuristic / noop responses
// are real, just keyword-driven — labeling them keeps the UI honest without
// looking like an error state.
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
