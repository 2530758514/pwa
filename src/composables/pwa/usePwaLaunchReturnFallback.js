import { onBeforeUnmount, onMounted, toValue } from 'vue'

const DEFAULT_FALLBACK_DELAY_MS = 2000
const DEFAULT_FALLBACK_MAX_AGE_MS = 10000
const DEFAULT_FALLBACK_RETRY_MS = 200

export function usePwaLaunchReturnFallback(options = {}) {
  const fallbackDelay = Number.isFinite(options.delay)
    ? options.delay
    : DEFAULT_FALLBACK_DELAY_MS
  const fallbackMaxAge = Number.isFinite(options.maxAge)
    ? options.maxAge
    : DEFAULT_FALLBACK_MAX_AGE_MS
  const fallbackRetry = Number.isFinite(options.retry)
    ? options.retry
    : DEFAULT_FALLBACK_RETRY_MS
  let fallbackTimer = null

  function clear() {
    if (!fallbackTimer || typeof window === 'undefined') return

    window.clearTimeout(fallbackTimer)
    fallbackTimer = null
  }

  function resolveLaunchTime() {
    if (typeof window === 'undefined') return 0

    try {
      const currentUrl = new URL(window.location.href)
      if (currentUrl.searchParams.get('pwa_launch') !== '1') return 0

      const launchTime = Number(currentUrl.searchParams.get('pwa_launch_time'))
      return Number.isFinite(launchTime) && launchTime > 0 ? launchTime : 0
    } catch {
      return 0
    }
  }

  function restore() {
    if (typeof window === 'undefined' || Boolean(toValue(options.isStandalone))) return

    const launchTime = resolveLaunchTime()
    if (!launchTime) return

    const now = Date.now()
    const fallbackDueAt = launchTime + fallbackDelay
    const fallbackExpiresAt = launchTime + fallbackMaxAge
    if (now > fallbackExpiresAt) return

    function tryFallback() {
      fallbackTimer = null

      const currentTime = Date.now()
      if (currentTime > fallbackExpiresAt || Boolean(toValue(options.isStandalone))) return

      if (
        typeof document === 'undefined' ||
        document.visibilityState === 'hidden' ||
        currentTime < fallbackDueAt ||
        options.onFallback?.() !== true
      ) {
        fallbackTimer = window.setTimeout(
          tryFallback,
          currentTime < fallbackDueAt
            ? Math.max(0, fallbackDueAt - currentTime)
            : fallbackRetry,
        )
      }
    }

    clear()
    fallbackTimer = window.setTimeout(tryFallback, Math.max(0, fallbackDueAt - now))
  }

  onMounted(restore)
  onBeforeUnmount(clear)

  return {
    clear,
    restore,
  }
}
