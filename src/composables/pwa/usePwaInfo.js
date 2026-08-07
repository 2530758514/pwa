import { computed, onMounted, readonly, shallowRef, watch } from 'vue'
import { pwaService } from '@/services/pwa'
import { capturePwaLandingAttribution } from '@/shared/analytics/pwaLandingAttribution'
import { setPwaIdRequestHeader } from '@/shared/api/http'
import { applyStoredPwaManifestUrl } from '@/shared/pwa/manifest'
import { readPwaInfoCache } from '@/shared/pwa/pwaInfoCache'
import { resolveIsPwaStandalone } from '@/shared/pwa/displayMode'

const cachedPwaInfo = (
  resolveIsPwaStandalone()
    ? readPwaInfoCache({ maxAgeMs: Number.POSITIVE_INFINITY })
    : readPwaInfoCache()
)?.pwaInfo || {}
const pwaInfo = shallowRef(cachedPwaInfo)
const loading = shallowRef(false)
const refreshing = shallowRef(false)
const error = shallowRef(null)
const PWA_INFO_WAIT_MS = 8000
const PWA_INFO_RETRY_DELAYS_MS = [1000, 3000, 10_000, 30_000]
let requestPromise = null
let retryTimer = 0
let retryAttempt = 0

if (Object.keys(cachedPwaInfo).length > 0) {
  setPwaIdRequestHeader(cachedPwaInfo.pwaId)
}

function hasUsablePwaInfo(value = pwaInfo.value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0)
}

function withTimeout(promise, waitMs = PWA_INFO_WAIT_MS) {
  let timer = null

  const timeoutPromise = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      reject(new Error('PWA info request timed out'))
    }, waitMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) window.clearTimeout(timer)
  })
}

function clearRetryTimer() {
  if (!retryTimer || typeof window === 'undefined') return

  window.clearTimeout(retryTimer)
  retryTimer = 0
}

function scheduleRetry() {
  if (retryTimer || typeof window === 'undefined') return

  const delayIndex = Math.min(retryAttempt, PWA_INFO_RETRY_DELAYS_MS.length - 1)
  const delay = PWA_INFO_RETRY_DELAYS_MS[delayIndex]
  retryAttempt += 1
  retryTimer = window.setTimeout(() => {
    retryTimer = 0
    void loadPwaInfo({ background: true })
  }, delay)
}

async function loadPwaInfo(options = {}) {
  if (requestPromise && options.force !== true) return requestPromise

  const shouldBlock = options.background !== true && !hasUsablePwaInfo()
  loading.value = shouldBlock
  refreshing.value = true
  error.value = null
  capturePwaLandingAttribution()

  const refreshRequest = pwaService.refreshPwaManifest(
    {},
    {
      forceRefresh: options.force === true,
      persist: true,
    },
  )

  requestPromise = withTimeout(refreshRequest)
    .then((result) => {
      const nextPwaInfo = result?.pwaInfo || {}

      if (hasUsablePwaInfo(nextPwaInfo)) {
        pwaInfo.value = nextPwaInfo
        retryAttempt = 0
        clearRetryTimer()
      }

      return pwaInfo.value
    })
    .catch((loadError) => {
      error.value = loadError
      applyStoredPwaManifestUrl()
      scheduleRetry()
      return pwaInfo.value
    })
    .finally(() => {
      loading.value = false
      refreshing.value = false
      requestPromise = null
    })

  return requestPromise
}

function waitForPwaInfo() {
  if (hasUsablePwaInfo()) return Promise.resolve(pwaInfo.value)

  return new Promise((resolve) => {
    const stop = watch(
      pwaInfo,
      (value) => {
        if (!hasUsablePwaInfo(value)) return

        stop()
        resolve(value)
      },
      { flush: 'sync' },
    )
  })
}

export function usePwaInfo({ autoLoad = true } = {}) {
  const hasPwaInfo = computed(() => hasUsablePwaInfo())

  onMounted(() => {
    if (autoLoad) void loadPwaInfo()
  })

  return {
    pwaInfo: readonly(pwaInfo),
    loading: readonly(loading),
    refreshing: readonly(refreshing),
    error: readonly(error),
    hasPwaInfo,
    loadPwaInfo,
    waitForPwaInfo,
  }
}

export function useSharedPwaInfo() {
  return {
    pwaInfo: readonly(pwaInfo),
    loading: readonly(loading),
    refreshing: readonly(refreshing),
    error: readonly(error),
  }
}
