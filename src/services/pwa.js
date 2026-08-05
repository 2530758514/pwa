import { pwaApi } from '@/api/pwa'
import { normalizePwaInfo } from '@/models/pwa'
import { setPwaIdRequestHeader } from '@/shared/api/http'
import { writePwaInfoCache } from '@/shared/pwa/pwaInfoCache'
import {
  applyIosPwaMetadata,
  applyLocalPwaManifest,
  applyStoredPwaManifestUrl,
  clearStoredPwaManifestData,
  createAndStorePwaManifest,
  fetchAndStorePwaManifest,
  getStoredPwaManifestInfo,
  getStoredPwaManifestUrl,
  shouldUseLocalPwaManifest,
} from '@/shared/pwa/manifest'

const pendingPwaInfoRequests = new Map()
const pendingRefreshManifestRequests = new Map()
const pendingEnsureManifestRequests = new Map()
const cachedPwaInfoResults = new Map()

function normalizeRequestValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeRequestValue)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) {
          result[key] = normalizeRequestValue(value[key])
        }
        return result
      }, {})
  }

  return value
}

function getPwaManifestRequestKey(params = {}, options = {}) {
  return JSON.stringify({
    params: normalizeRequestValue(params || {}),
    options: normalizeRequestValue(options || {}),
  })
}

function runPwaManifestRequestOnce(requestMap, requestKey, requestFactory) {
  if (!requestMap.has(requestKey)) {
    const request = requestFactory()

    requestMap.set(requestKey, request)
    request.then(
      () => requestMap.delete(requestKey),
      () => requestMap.delete(requestKey),
    )
  }

  return requestMap.get(requestKey)
}

function resolvePwaInstallName(pwaInfo = {}) {
  return (
    pwaInfo.pwaInstallName ||
    pwaInfo.installName ||
    pwaInfo.pwa_name ||
    pwaInfo.pwaName ||
    pwaInfo.name ||
    ''
  )
}

function resolvePwaManifestOverrides(pwaInfo = {}) {
  const name = resolvePwaInstallName(pwaInfo)
  const icon = pwaInfo.logo || pwaInfo.pwa_logo || pwaInfo.pwaLogo || pwaInfo.icon || ''

  return {
    name,
    short_name: name,
    description:
      pwaInfo.description ||
      pwaInfo.introduction ||
      pwaInfo.store_description ||
      pwaInfo.storeDescription ||
      '',
    icon,
    screenshots: pwaInfo.screenshots || pwaInfo.pwa_carousel || pwaInfo.pwaCarousel || [],
  }
}

function applyPwaInstallMetadata(pwaInfo = {}) {
  const icon = pwaInfo.logo || pwaInfo.pwa_logo || pwaInfo.pwaLogo || pwaInfo.icon || ''
  const metadata = {
    name: resolvePwaInstallName(pwaInfo),
    icon,
  }

  applyIosPwaMetadata({
    name: metadata.name,
    icon: metadata.icon,
  })
}

export const pwaService = {
  recordAndroidPwaDownloadPageVisit() {
    return pwaApi.recordAndroidPwaDownloadPageVisit()
  },
  recordAndroidPwaInstallCompletion() {
    return pwaApi.recordAndroidPwaInstallCompletion()
  },
  recordAndroidPwaNotificationClick() {
    return pwaApi.recordAndroidPwaNotificationClick()
  },
  async getPwaInfo(params = {}, options = {}) {
    const requestKey = getPwaManifestRequestKey(params, { detail: true })

    if (options.forceRefresh === true) {
      cachedPwaInfoResults.delete(requestKey)
    }

    if (cachedPwaInfoResults.has(requestKey)) {
      const pwaInfo = cachedPwaInfoResults.get(requestKey)
      setPwaIdRequestHeader(pwaInfo?.pwaId)
      return pwaInfo
    }

    return await runPwaManifestRequestOnce(pendingPwaInfoRequests, requestKey, async () => {
      const pwaInfo = normalizePwaInfo(await pwaApi.getPwaInfo(params))
      setPwaIdRequestHeader(pwaInfo.pwaId)
      writePwaInfoCache(pwaInfo)

      cachedPwaInfoResults.set(requestKey, pwaInfo)

      return pwaInfo
    })
  },

  async ensureCachedPwaManifest(params = {}) {
    const requestKey = getPwaManifestRequestKey(params, { persist: true })

    return await runPwaManifestRequestOnce(pendingEnsureManifestRequests, requestKey, async () => {
      if (shouldUseLocalPwaManifest()) {
        return {
          fromCache: true,
          manifestInfo: null,
          manifestHref: applyLocalPwaManifest(),
        }
      }

      const cachedManifestInfo = getStoredPwaManifestInfo()

      if (cachedManifestInfo) {
        applyStoredPwaManifestUrl()
        return {
          fromCache: true,
          manifestInfo: cachedManifestInfo,
        }
      }

      const storedManifestUrl = getStoredPwaManifestUrl()

      if (storedManifestUrl) {
        try {
          const refreshedManifest = await pwaService.refreshPwaManifest(params, { persist: true })

          if (refreshedManifest?.manifestInfo) return refreshedManifest
        } catch {
          applyStoredPwaManifestUrl()
          return {
            fromCache: true,
            manifestInfo: null,
          }
        }
      }

      return pwaService.refreshPwaManifest(params, { persist: true })
    })
  },

  async refreshPwaManifest(params = {}, options = {}) {
    const forceRefresh = options.forceRefresh === true
    const requestOptions = {
      persist: options.persist === true,
      manifestOverrides: options.manifestOverrides || {},
    }

    if (forceRefresh) {
      requestOptions.forceRefresh = true
    }

    const requestKey = getPwaManifestRequestKey(params, requestOptions)

    return await runPwaManifestRequestOnce(pendingRefreshManifestRequests, requestKey, async () => {
      if (forceRefresh) {
        await clearStoredPwaManifestData()
      }

      const pwaInfo = await pwaService.getPwaInfo(params, { forceRefresh })
      applyPwaInstallMetadata(pwaInfo)
      const manifestOverrides = {
        ...resolvePwaManifestOverrides(pwaInfo),
        ...(options.manifestOverrides || {}),
      }

      if (shouldUseLocalPwaManifest()) {
        return {
          fromCache: false,
          pwaInfo,
          manifestInfo: null,
          manifestHref: applyLocalPwaManifest(),
        }
      }

      if (pwaInfo.configUrl) {
        try {
          const manifestInfo = await fetchAndStorePwaManifest(pwaInfo.configUrl, {
            manifestOverrides,
          })

          return {
            fromCache: false,
            pwaInfo,
            manifestInfo,
          }
        } catch {
          // Keep the shell installable with generated manifest data.
        }
      }

      const manifestInfo = await createAndStorePwaManifest(manifestOverrides).catch(() => null)

      return {
        fromCache: false,
        pwaInfo,
        manifestInfo,
      }
    })
  },
}
