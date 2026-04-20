import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Resets window scroll position to the top whenever the route changes.
// Without this, clicking a post from mid-feed drops you into the detail
// page at the same scroll offset as the feed, which reads as broken.
// Uses instant scroll so route transitions don't feel laggy.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export default ScrollToTop
