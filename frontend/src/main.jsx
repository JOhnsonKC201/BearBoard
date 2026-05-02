import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { warmBackend, prefetchHomeInitial } from './api/client'
import './index.css'

// Fire a health ping immediately so Render has a head start waking the
// backend before the user's first data-bearing GET. Fire-and-forget; the
// user never sees this request.
warmBackend()

// Kick off the bundled landing-page fetch in parallel with React mounting.
// By the time Home.jsx's effects run, this is often already settled, so
// the page paints from prime'd cache instead of waiting on the network.
// Skipped on non-Home routes (cheap heuristic: pathname check) so a deep
// link to /map or /chat doesn't waste a request.
if (typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '')) {
  prefetchHomeInitial()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
