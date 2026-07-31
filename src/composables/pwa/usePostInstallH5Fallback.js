import { onBeforeUnmount, onMounted, toValue } from 'vue'

const DEFAULT_FALLBACK_DELAY_MS = 30000
const POST_INSTALL_H5_FALLBACK_SESSION_KEY = 'pwa:post-install-h5-fallback-pending'

export function usePostInstallH5Fallback(options = {}) {
  const fallbackDelay = Number.isFinite(options.delay)
    ? options.delay
    : DEFAULT_FALLBACK_DELAY_MS
  let fallbackTimer = null
  let fallbackPending = false
  let fallbackDueAt = 0
  let pageHiddenAt = 0

  function clearFallbackTimer() {
    if (!fallbackTimer || typeof window === 'undefined') return

    window.clearTimeout(fallbackTimer)
    fallbackTimer = null
  }

  function removeStoredFallback() {
    if (typeof window === 'undefined') return

    try {
      window.sessionStorage.removeItem(POST_INSTALL_H5_FALLBACK_SESSION_KEY)
    } catch {
      // The in-memory state is already cleared.
    }
  }

  function clear() {
    clearFallbackTimer()
    fallbackPending = false
    fallbackDueAt = 0
    pageHiddenAt = 0
    removeStoredFallback()
  }

  function persistFallback() {
    if (typeof window === 'undefined' || !fallbackPending || !fallbackDueAt) return

    try {
      window.sessionStorage.setItem(
        POST_INSTALL_H5_FALLBACK_SESSION_KEY,
        JSON.stringify({ dueAt: fallbackDueAt }),
      )
    } catch {
      // Keep the in-memory fallback when session storage is unavailable.
    }
  }

  function readStoredFallbackDueAt() {
    if (typeof window === 'undefined') return 0

    try {
      const state = JSON.parse(
        window.sessionStorage.getItem(POST_INSTALL_H5_FALLBACK_SESSION_KEY) || 'null',
      )
      const dueAt = Number(state?.dueAt)

      if (Number.isFinite(dueAt) && dueAt > 0) return dueAt
    } catch {
      // Invalid stored state is removed below.
    }

    removeStoredFallback()
    return 0
  }

  function runFallback() {
    clearFallbackTimer()

    if (!fallbackPending) return false
    if (Boolean(toValue(options.isStandalone))) {
      clear()
      return false
    }
    if (typeof document === 'undefined' || document.visibilityState === 'hidden') {
      clear()
      return false
    }

    const redirected = options.onFallback?.() === true
    clear()
    return redirected
  }

  function schedule(scheduleOptions = {}) {
    if (typeof window === 'undefined' || Boolean(toValue(options.isStandalone))) return

    const requestedDueAt = Number(scheduleOptions.dueAt)
    const dueAt =
      Number.isFinite(requestedDueAt) && requestedDueAt > 0
        ? requestedDueAt
        : Date.now() + fallbackDelay

    clearFallbackTimer()
    fallbackPending = true
    fallbackDueAt = dueAt
    pageHiddenAt =
      typeof document !== 'undefined' && document.visibilityState === 'hidden'
        ? Date.now()
        : 0
    persistFallback()
    fallbackTimer = window.setTimeout(runFallback, Math.max(0, dueAt - Date.now()))
  }

  function handlePageStateChange(event) {
    const pageHidden =
      event?.type === 'pagehide' ||
      (typeof document !== 'undefined' && document.visibilityState === 'hidden')

    if (pageHidden) {
      if (fallbackPending) pageHiddenAt = Date.now()
      return
    }

    if (fallbackPending && Date.now() >= fallbackDueAt) {
      if (pageHiddenAt && pageHiddenAt <= fallbackDueAt) {
        clear()
        return
      }
      runFallback()
      return
    }

    pageHiddenAt = 0
  }

  function restore() {
    const dueAt = readStoredFallbackDueAt()
    if (!dueAt) return

    schedule({ dueAt })
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handlePageStateChange)
    window.addEventListener('pageshow', handlePageStateChange)
    window.addEventListener('pagehide', handlePageStateChange)
    restore()
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', handlePageStateChange)
    window.removeEventListener('pageshow', handlePageStateChange)
    window.removeEventListener('pagehide', handlePageStateChange)
    clearFallbackTimer()
  })

  return {
    clear,
    schedule,
  }
}
