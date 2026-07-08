import { STORAGE_KEYS } from '@/shared/storage/keys'
import { storage } from '@/shared/storage/storage'

const URL_ATTRIBUTION_PARAM_ALIASES = {
  fbclid: ['fbclid', 'pixelId'],
  fbc: ['x-fbc', 'x_fbc', 'fbc', '_fbc'],
  fbp: ['x-fbp', 'x_fbp', 'fbp', '_fbp'],
  event_source_url: ['event_source_url', 'eventSourceUrl'],
}

function readCookie(name) {
  if (typeof document === 'undefined') return ''

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function readLocalStorage(name) {
  if (typeof localStorage === 'undefined') return ''

  try {
    return normalizeClickId(localStorage.getItem(name))
  } catch {
    return ''
  }
}

function writeLocalStorage(name, value) {
  if (typeof localStorage === 'undefined') return

  const normalized = normalizeClickId(value)
  if (!normalized) return

  try {
    localStorage.setItem(name, normalized)
  } catch {
    // Attribution persistence is best effort in restricted browser storage modes.
  }
}

function buildFbc(fbclid) {
  if (!fbclid) return ''

  return `fb.1.${Date.now()}.${fbclid}`
}

function normalizeClickId(value) {
  const normalized = String(value ?? '').trim()

  if (!normalized || normalized === 'null' || normalized === 'undefined') return ''

  return normalized
}

function getEventSourceUrl() {
  if (typeof window === 'undefined') return ''

  return window.location.href || ''
}

function getUrlParamSources() {
  if (typeof window === 'undefined') return []

  const sources = [new URLSearchParams(window.location.search)]
  const hash = window.location.hash || ''
  const queryIndex = hash.indexOf('?')

  if (queryIndex !== -1) {
    sources.push(new URLSearchParams(hash.slice(queryIndex + 1)))
  }

  return sources
}

function getUrlAttributionParam(names = []) {
  for (const params of getUrlParamSources()) {
    for (const name of names) {
      const value = normalizeClickId(params.get(name))
      if (value) return value
    }
  }

  return ''
}

function getUrlFacebookAttribution() {
  return {
    fbclid: getUrlAttributionParam(URL_ATTRIBUTION_PARAM_ALIASES.fbclid),
    fbc: getUrlAttributionParam(URL_ATTRIBUTION_PARAM_ALIASES.fbc),
    fbp: getUrlAttributionParam(URL_ATTRIBUTION_PARAM_ALIASES.fbp),
    event_source_url: getUrlAttributionParam(URL_ATTRIBUTION_PARAM_ALIASES.event_source_url),
  }
}

export function getFacebookClickId() {
  return (
    getUrlAttributionParam(URL_ATTRIBUTION_PARAM_ALIASES.fbclid) ||
    storage.get(STORAGE_KEYS.facebookAttribution, {})?.fbclid ||
    readLocalStorage('fbclid')
  )
}

export function persistFacebookAttribution(attribution = {}) {
  const previousAttribution = storage.get(STORAGE_KEYS.facebookAttribution, {}) || {}
  const normalizedFbclid = normalizeClickId(attribution.fbclid)
  const normalizedFbp = normalizeClickId(attribution.fbp)
  const normalizedFbc = normalizeClickId(attribution.fbc)
  const normalizedEventSourceUrl = normalizeClickId(attribution.event_source_url)

  if (normalizedFbclid) writeLocalStorage('fbclid', normalizedFbclid)
  if (normalizedFbp) writeLocalStorage('fbp', normalizedFbp)
  if (normalizedFbc) writeLocalStorage('fbc', normalizedFbc)

  const resolvedFbclid = normalizedFbclid || previousAttribution.fbclid || readLocalStorage('fbclid')
  const nextAttribution = {
    ...previousAttribution,
    fbclid: resolvedFbclid || '',
    fbp: normalizedFbp || previousAttribution.fbp || readLocalStorage('fbp') || readCookie('_fbp') || '',
    fbc:
      normalizedFbc ||
      previousAttribution.fbc ||
      readLocalStorage('fbc') ||
      readCookie('_fbc') ||
      buildFbc(resolvedFbclid),
    event_source_url: normalizedEventSourceUrl || previousAttribution.event_source_url || '',
    source_param: attribution.source_param || previousAttribution.source_param || '',
    source_value:
      attribution.source_value ||
      previousAttribution.source_value ||
      normalizedFbclid ||
      normalizedFbc ||
      normalizedFbp ||
      '',
  }

  storage.set(STORAGE_KEYS.facebookAttribution, nextAttribution)

  return nextAttribution
}

export function captureFacebookUrlAttribution() {
  const urlAttribution = getUrlFacebookAttribution()
  const hasUrlAttribution = Object.values(urlAttribution).some(Boolean)

  if (!hasUrlAttribution) return storage.get(STORAGE_KEYS.facebookAttribution, {}) || {}

  return persistFacebookAttribution(urlAttribution)
}

export function getFacebookAttribution() {
  const urlAttribution = getUrlFacebookAttribution()
  const savedAttribution = captureFacebookUrlAttribution()
  const fbclid = getFacebookClickId()
  const fbp = urlAttribution.fbp || savedAttribution.fbp || readLocalStorage('fbp') || readCookie('_fbp')
  const fbc =
    urlAttribution.fbc ||
    savedAttribution.fbc ||
    readLocalStorage('fbc') ||
    readCookie('_fbc') ||
    buildFbc(fbclid)

  return {
    fbclid,
    fbp,
    fbc,
    event_source_url: urlAttribution.event_source_url || savedAttribution.event_source_url || '',
  }
}

export function appendFacebookAttributionHeaders(headers = {}) {
  const attribution = getFacebookAttribution()
  const eventSourceUrl = attribution.event_source_url || getEventSourceUrl()

  if (eventSourceUrl) headers.event_source_url = eventSourceUrl
  if (attribution.fbc) headers['x-fbc'] = attribution.fbc
  if (attribution.fbp) headers['x-fbp'] = attribution.fbp
  if (attribution.fbclid) headers.fbclid = attribution.fbclid

  return headers
}
