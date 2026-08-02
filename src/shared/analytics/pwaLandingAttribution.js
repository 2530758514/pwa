import {
  getFacebookAttribution,
  getFacebookClickId,
  persistFacebookAttribution,
} from '@/shared/analytics/facebookAttribution'
import { appendFacebookAttributionParams } from '@/shared/analytics/facebookAttributionParams'
import { STORAGE_KEYS } from '@/shared/storage/keys'
import { storage } from '@/shared/storage/storage'

const PWA_ID_PARAM_NAMES = ['pwa_id', 'pwaId']
const PWA_URL_ID_PARAM_NAMES = ['pwa_url_id', 'pwaUrlId']

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

function getFirstParamValue(params, names) {
  for (const name of names) {
    const value = normalizeAttributionValue(params.get(name))

    if (value) return value
  }

  return ''
}

function getLandingUrlAttribution() {
  const attribution = {}

  for (const params of getUrlParamSources()) {
    const fbclid = normalizeAttributionValue(params.get('fbclid'))
    const pixelId = normalizeAttributionValue(params.get('pixelId'))

    if (!attribution.fbclid && fbclid) {
      attribution.fbclid = fbclid
      attribution.source_param = 'fbclid'
      attribution.source_value = fbclid
    } else if (!attribution.fbclid && pixelId) {
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
    const pwaId = getFirstParamValue(params, PWA_ID_PARAM_NAMES)
    const pwaUrlId = getFirstParamValue(params, PWA_URL_ID_PARAM_NAMES)

    if (!attribution.fbc && fbc) attribution.fbc = fbc
    if (!attribution.fbp && fbp) attribution.fbp = fbp
    if (!attribution.event_source_url && eventSourceUrl) {
      attribution.event_source_url = eventSourceUrl
    }
    if (!attribution.pwa_id && pwaId) attribution.pwa_id = pwaId
    if (!attribution.pwa_url_id && pwaUrlId) attribution.pwa_url_id = pwaUrlId
  }

  if (
    !attribution.event_source_url &&
    (attribution.fbclid || attribution.fbc || attribution.fbp) &&
    hasBrowserRuntime()
  ) {
    attribution.event_source_url = window.location.href
  }

  return Object.values(attribution).some(Boolean) ? attribution : null
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

  const previousAttribution = getStoredLandingAttribution()
  const nextAttribution = {
    ...previousAttribution,
    ...attribution,
    captured_at: Date.now(),
  }

  if (
    attribution.fbclid &&
    attribution.fbclid !== previousAttribution.fbclid &&
    !attribution.fbc
  ) {
    delete nextAttribution.fbc
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

export function appendStoredPwaFacebookAttributionParams(targetParams) {
  return appendFacebookAttributionParams(targetParams, {
    ...getFacebookAttribution(),
    ...getStoredLandingAttribution(),
  })
}
