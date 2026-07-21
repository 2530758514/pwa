import { STORAGE_KEYS } from '@/shared/storage/keys'
import { storage } from '@/shared/storage/storage'

const BIGO_CLICK_ID_PARAM = 'bbg'
const BIGO_PIXEL_ID_PARAM = 'pixel_id'
const BIGO_CLICK_ID_HEADER = 'X-Bigo-Click-Id'
const LEGACY_BIGO_CLICK_ID_PARAM = 'bigo_click_id'
const LEGACY_BIGO_PIXEL_ID_PARAM = 'bigo_pixel_id'
let currentBigoAttribution = null

function normalizeValue(value) {
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

function getUrlBigoAttribution() {
  for (const params of getUrlParamSources()) {
    const clickId = normalizeValue(
      params.get(BIGO_CLICK_ID_PARAM) || params.get(LEGACY_BIGO_CLICK_ID_PARAM),
    )
    const pixelId = normalizeValue(
      params.get(BIGO_PIXEL_ID_PARAM) || params.get(LEGACY_BIGO_PIXEL_ID_PARAM),
    )

    if (clickId || pixelId) {
      return { clickId, pixelId }
    }
  }

  return null
}

function removeStoredValue(key) {
  try {
    storage.remove(key)
  } catch {
    // Attribution cleanup is best effort in restricted browser storage modes.
  }
}

function removeLocalStorageValue(key) {
  if (!hasBrowserRuntime()) return

  try {
    window.localStorage?.removeItem(key)
  } catch {
    // Attribution cleanup is best effort in restricted browser storage modes.
  }
}

function clearFacebookClickAttribution() {
  removeStoredValue(STORAGE_KEYS.facebookAttribution)
  removeStoredValue(STORAGE_KEYS.landingAttribution)
  removeStoredValue(STORAGE_KEYS.pwaLandingAttribution)
  removeLocalStorageValue('fbclid')
}

function deleteHeader(headers, name) {
  if (!headers) return

  if (typeof headers.delete === 'function') {
    headers.delete(name)
    return
  }

  const normalizedName = name.toLowerCase()

  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === normalizedName) delete headers[key]
  })
}

function setHeader(headers, name, value) {
  if (typeof headers.set === 'function') {
    headers.set(name, value)
    return
  }

  headers[name] = value
}

function getStoredAttribution() {
  try {
    const attribution = storage.get(STORAGE_KEYS.bigoAttribution, null)

    if (!attribution || typeof attribution !== 'object' || Array.isArray(attribution)) {
      return null
    }

    const clickId = normalizeValue(attribution.clickId)
    const pixelId = normalizeValue(attribution.pixelId)

    if (!clickId && !pixelId) return null

    return {
      clickId,
      pixelId,
      capturedAt: Number(attribution.capturedAt) || 0,
    }
  } catch {
    return null
  }
}

export function captureBigoAttribution() {
  const urlAttribution = getUrlBigoAttribution()

  if (!urlAttribution) {
    currentBigoAttribution = getStoredAttribution()
    return currentBigoAttribution
  }

  const attribution = {
    ...urlAttribution,
    capturedAt: Date.now(),
  }
  currentBigoAttribution = attribution

  if (attribution.clickId) clearFacebookClickAttribution()

  try {
    storage.set(STORAGE_KEYS.bigoAttribution, attribution)
  } catch {
    // Attribution persistence is best effort in restricted browser storage modes.
  }

  return attribution
}

export function getStoredBigoAttribution() {
  return currentBigoAttribution || getStoredAttribution() || { clickId: '', pixelId: '', capturedAt: 0 }
}

export function getStoredBigoClickId() {
  return getStoredBigoAttribution().clickId
}

export function getStoredBigoPixelId() {
  return getStoredBigoAttribution().pixelId
}

export function appendBigoAttributionParams(searchParams) {
  if (!searchParams?.set) return searchParams

  const { clickId, pixelId } = getStoredBigoAttribution()

  searchParams.delete(LEGACY_BIGO_CLICK_ID_PARAM)
  searchParams.delete(LEGACY_BIGO_PIXEL_ID_PARAM)

  if (clickId) searchParams.set(BIGO_CLICK_ID_PARAM, clickId)
  if (pixelId) searchParams.set(BIGO_PIXEL_ID_PARAM, pixelId)

  return searchParams
}

export function appendBigoAttributionHeaders(headers = {}) {
  const clickId = getStoredBigoClickId()

  deleteHeader(headers, LEGACY_BIGO_CLICK_ID_PARAM)

  if (clickId) setHeader(headers, BIGO_CLICK_ID_HEADER, clickId)

  return headers
}

export function clearBigoAttribution() {
  currentBigoAttribution = null
  removeStoredValue(STORAGE_KEYS.bigoAttribution)
  removeLocalStorageValue(BIGO_CLICK_ID_PARAM)
  removeLocalStorageValue(LEGACY_BIGO_CLICK_ID_PARAM)
}

export {
  BIGO_CLICK_ID_HEADER,
  BIGO_CLICK_ID_PARAM,
  BIGO_PIXEL_ID_PARAM,
  LEGACY_BIGO_CLICK_ID_PARAM,
  LEGACY_BIGO_PIXEL_ID_PARAM,
}
