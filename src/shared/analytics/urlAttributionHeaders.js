import { STORAGE_KEYS } from '@/shared/storage/keys'
import { storage } from '@/shared/storage/storage'

const URL_ATTRIBUTION_HEADER = 'X-Landing-Params'
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

function hasBrowserRuntime() {
  return typeof window !== 'undefined'
}

function normalizeValue(value) {
  const normalized = String(value ?? '').trim()

  if (!normalized || normalized === 'null' || normalized === 'undefined') return ''

  return normalized
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

function collectCurrentUrlParams() {
  const params = {}

  for (const source of getUrlParamSources()) {
    source.forEach((value, key) => {
      const normalizedKey = normalizeValue(key)
      const normalizedValue = normalizeValue(value)

      if (!normalizedKey || !normalizedValue || params[normalizedKey]) return

      params[normalizedKey] = normalizedValue
    })
  }

  return params
}

function getStoredUrlParams() {
  const params = storage.get(STORAGE_KEYS.urlAttributionParams, null)

  return params && typeof params === 'object' && !Array.isArray(params) ? params : {}
}

function getUrlAttributionParams() {
  const currentParams = collectCurrentUrlParams()

  if (Object.keys(currentParams).length) {
    storage.set(STORAGE_KEYS.urlAttributionParams, currentParams)
    return currentParams
  }

  return getStoredUrlParams()
}

function buildSerializedParams(params) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    const normalizedKey = normalizeValue(key)
    const normalizedValue = normalizeValue(value)

    if (!normalizedKey || !normalizedValue) return

    searchParams.set(normalizedKey, normalizedValue)
  })

  return searchParams.toString()
}

export function appendUrlAttributionHeaders(headers = {}) {
  const params = getUrlAttributionParams()
  const serializedParams = buildSerializedParams(params)

  if (serializedParams && !headers[URL_ATTRIBUTION_HEADER]) {
    headers[URL_ATTRIBUTION_HEADER] = serializedParams
  }

  Object.entries(params).forEach(([key, value]) => {
    const normalizedKey = normalizeValue(key)
    const normalizedValue = normalizeValue(value)

    if (!normalizedKey || !normalizedValue || !HEADER_NAME_PATTERN.test(normalizedKey)) return
    if (headers[normalizedKey]) return

    headers[normalizedKey] = normalizedValue
  })

  return headers
}
