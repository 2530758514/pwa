import { getFacebookClickId, persistFacebookAttribution } from '@/shared/analytics/facebookAttribution'
import { STORAGE_KEYS } from '@/shared/storage/keys'
import { storage } from '@/shared/storage/storage'

function normalizeAttributionValue(value) {
  const normalized = String(value ?? '').trim()

  if (!normalized || normalized === 'null' || normalized === 'undefined') return ''

  return normalized
}

function hasBrowserRuntime() {
  return typeof window !== 'undefined'
}

function getUrlParamSources() {
  if (!hasBrowserRuntime()) return []

  const sources = [new URLSearchParams(window.location.search)]
  const hash = window.location.hash || ''
  const queryIndex = hash.indexOf('?')

  if (queryIndex !== -1) {
    sources.push(new URLSearchParams(hash.slice(queryIndex + 1)))
  }

  return sources
}

function getLandingUrlAttribution() {
  for (const params of getUrlParamSources()) {
    const attribution = {}
    const fbclid = normalizeAttributionValue(params.get('fbclid'))
    const pixelId = normalizeAttributionValue(params.get('pixelId'))

    if (fbclid) {
      attribution.fbclid = fbclid
      attribution.source_param = 'fbclid'
      attribution.source_value = fbclid
    } else if (pixelId) {
      attribution.fbclid = pixelId
      attribution.source_param = 'pixelId'
      attribution.source_value = pixelId
    }

    const fbc = normalizeAttributionValue(
      params.get('x-fbc') || params.get('x_fbc') || params.get('fbc') || params.get('_fbc'),
    )
    const fbp = normalizeAttributionValue(
      params.get('x-fbp') || params.get('x_fbp') || params.get('fbp') || params.get('_fbp'),
    )
    const eventSourceUrl = normalizeAttributionValue(
      params.get('event_source_url') || params.get('eventSourceUrl'),
    )

    if (fbc) attribution.fbc = fbc
    if (fbp) attribution.fbp = fbp
    if (eventSourceUrl) attribution.event_source_url = eventSourceUrl

    if (Object.values(attribution).some(Boolean)) return attribution
  }

  return null
}

function getStoredLandingAttribution() {
  return (
    storage.get(STORAGE_KEYS.landingAttribution, null) ||
    storage.get(STORAGE_KEYS.pwaLandingAttribution, {}) ||
    {}
  )
}

function saveLandingAttribution(attribution) {
  if (!hasBrowserRuntime()) return ''
  if (!attribution || !Object.values(attribution).some(Boolean)) return ''

  const nextAttribution = {
    ...getStoredLandingAttribution(),
    ...attribution,
    captured_at: Date.now(),
  }

  storage.set(STORAGE_KEYS.landingAttribution, nextAttribution)
  storage.set(STORAGE_KEYS.pwaLandingAttribution, nextAttribution)
  persistFacebookAttribution(nextAttribution)

  return nextAttribution.fbclid || ''
}

export function capturePwaLandingAttribution() {
  return saveLandingAttribution(getLandingUrlAttribution())
}

export function restoreLandingAttribution() {
  if (!hasBrowserRuntime()) return ''

  const storedAttribution = getStoredLandingAttribution()
  const fbclid = normalizeAttributionValue(storedAttribution.fbclid)

  if (!fbclid && !storedAttribution.fbc && !storedAttribution.fbp) return ''

  persistFacebookAttribution(storedAttribution)

  return fbclid
}

export function getPwaAttributionClickId() {
  return capturePwaLandingAttribution() || restoreLandingAttribution() || getFacebookClickId()
}
