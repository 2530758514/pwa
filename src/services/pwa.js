import { pwaApi } from '@/api/pwa'
import { normalizePwaInfo } from '@/models/pwa'
import {
  applyIosPwaMetadata,
  applyLocalPwaManifest,
  applyStoredPwaManifestUrl,
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

function resolvePwaManifestOverrides(pwaInfo = {}) {
  return {
    name: pwaInfo.name || pwaInfo.pwa_name || pwaInfo.pwaName || '',
    description:
      pwaInfo.description ||
      pwaInfo.introduction ||
      pwaInfo.store_description ||
      pwaInfo.storeDescription ||
      '',
    icon: pwaInfo.icon || pwaInfo.logo || pwaInfo.pwa_logo || pwaInfo.pwaLogo || '',
    screenshots: pwaInfo.screenshots || pwaInfo.pwa_carousel || pwaInfo.pwaCarousel || [],
  }
}

function applyPwaInstallMetadata(pwaInfo = {}) {
  const metadata = resolvePwaManifestOverrides(pwaInfo)

  applyIosPwaMetadata({
    name: metadata.name,
    icon: metadata.icon,
  })
}

export const pwaService = {
  async getPwaInfo(params = {}) {
    const requestKey = getPwaManifestRequestKey(params, { detail: true })

    if (cachedPwaInfoResults.has(requestKey)) {
      return cachedPwaInfoResults.get(requestKey)
    }

    return await runPwaManifestRequestOnce(pendingPwaInfoRequests, requestKey, async () => {
      const pwaInfo = normalizePwaInfo(await pwaApi.getPwaInfo(params))

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
    const requestKey = getPwaManifestRequestKey(params, {
      persist: options.persist === true,
    })

    return await runPwaManifestRequestOnce(pendingRefreshManifestRequests, requestKey, async () => {
      const pwaInfo = await pwaService.getPwaInfo(params)
      applyPwaInstallMetadata(pwaInfo)
      const manifestOverrides = resolvePwaManifestOverrides(pwaInfo)

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
