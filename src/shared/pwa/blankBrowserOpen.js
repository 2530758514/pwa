import { buildSafariOpenUrl } from './safariOpenUrl.js'

export function buildBlankBrowserOpenUrl(value, isApple) {
  if (isApple) return buildSafariOpenUrl(value)
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return ''
    return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(url.href)};end`
  } catch {
    return ''
  }
}

// Dispatch before rendering the fallback guide. Returning to the page only reveals
// the guide; it never triggers another automatic browser-opening attempt.
export function createBlankBrowserOpener({ target, navigate, now = Date.now,
  canOpen = () => true, onFallback = () => {} }) {
  let started = false
  let disposed = false
  let fallbackDue = false
  let revealed = false
  let lastAttempt = -Infinity
  function reveal() {
    if (disposed || revealed || !fallbackDue || !canOpen()) return
    revealed = true
    onFallback()
  }
  function attempt() {
    if (disposed || !target || !canOpen()) return
    lastAttempt = now()
    try { navigate(target) } catch { /* The fallback stays available if the host rejects the scheme. */ }
  }
  return {
    start() {
      if (started || disposed) return
      started = true
      attempt()
      fallbackDue = true
      reveal()
    },
    open() {
      if (disposed) return
      started = true
      fallbackDue = true
      reveal()
      if (now() - lastAttempt < 800) return
      attempt()
    },
    resume() { reveal() },
    dispose() { disposed = true },
  }
}

export function formatBlankBrowserReward(value, confirmed) {
  if (!confirmed || !['string', 'number'].includes(typeof value)) return ''
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return ''
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount < 0) return ''
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 20 })}`
}
