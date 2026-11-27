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

// One automatic attempt per mounted white-screen guide, independent of metadata refreshes.
export function createBlankBrowserOpener({ target, navigate, setTimer = setTimeout,
  clearTimer = clearTimeout, now = Date.now, canOpen = () => true }) {
  let timer = null
  let started = false
  let disposed = false
  let lastAttempt = -Infinity
  function attempt() {
    if (disposed || !target || !canOpen()) return
    lastAttempt = now()
    try { navigate(target) } catch { /* Keep the guide visible if the host rejects the scheme. */ }
  }
  function cancelTimer() {
    if (timer !== null) clearTimer(timer)
    timer = null
  }
  return {
    start() {
      if (started || disposed) return
      started = true
      if (!target) return
      timer = setTimer(() => { timer = null; attempt() }, 1000)
    },
    open() {
      started = true
      cancelTimer()
      if (now() - lastAttempt < 800) return
      attempt()
    },
    dispose() { disposed = true; cancelTimer() },
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
