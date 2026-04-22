import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { warmBackend } from './api/client'
import './index.css'

// Fire a health ping immediately so Render has a head start waking the
// backend before the user's first data-bearing GET. Fire-and-forget; the
// user never sees this request.
warmBackend()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
