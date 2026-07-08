import { computed, onMounted, readonly, shallowRef } from 'vue'
import { pwaService } from '@/services/pwa'
import { capturePwaLandingAttribution } from '@/shared/analytics/pwaLandingAttribution'
import { applyStoredPwaManifestUrl } from '@/shared/pwa/manifest'

const pwaInfo = shallowRef({})
const loading = shallowRef(false)
const error = shallowRef(null)
const PWA_INFO_WAIT_MS = 8000
let requestPromise = null

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

export function usePwaInfo() {
  async function loadPwaInfo(options = {}) {
    if (requestPromise && options.force !== true) return requestPromise

    loading.value = true
    error.value = null
    capturePwaLandingAttribution()

    const refreshRequest = pwaService.refreshPwaManifest({}, { persist: true })

    requestPromise = withTimeout(refreshRequest)
      .then((result) => {
        pwaInfo.value = result?.pwaInfo || {}
        return pwaInfo.value
      })
      .catch((loadError) => {
        error.value = loadError
        applyStoredPwaManifestUrl()
        return pwaInfo.value
      })
      .finally(() => {
        loading.value = false
        requestPromise = null
      })

    return requestPromise
  }

  const hasPwaInfo = computed(() => Object.keys(pwaInfo.value || {}).length > 0)

  onMounted(() => {
    void loadPwaInfo()
  })

  return {
    pwaInfo: readonly(pwaInfo),
    loading: readonly(loading),
    error: readonly(error),
    hasPwaInfo,
    loadPwaInfo,
  }
}

export function useSharedPwaInfo() {
  return {
    pwaInfo: readonly(pwaInfo),
    loading: readonly(loading),
    error: readonly(error),
  }
}
