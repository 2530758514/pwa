import { STORAGE_KEYS } from '../storage/keys.js'
import { storage } from '../storage/storage.js'

export const PWA_INFO_CACHE_VERSION = 1
export const PWA_INFO_CACHE_MAX_AGE_MS = 30 * 60 * 1000

function isUsablePwaInfo(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0,
  )
}

export function readPwaInfoCache({
  store = storage,
  now = Date.now(),
  maxAgeMs = PWA_INFO_CACHE_MAX_AGE_MS,
} = {}) {
  try {
    const record = store.get(STORAGE_KEYS.pwaInfoCache, null)
    const savedAt = Number(record?.savedAt)
    const age = now - savedAt

    if (
      record?.version !== PWA_INFO_CACHE_VERSION ||
      !isUsablePwaInfo(record.pwaInfo) ||
      !Number.isFinite(savedAt) ||
      age < 0 ||
      age > maxAgeMs
    ) {
      return null
    }

    return Object.freeze({
      pwaInfo: record.pwaInfo,
      savedAt,
    })
  } catch {
    return null
  }
}

export function writePwaInfoCache(pwaInfo, { store = storage, now = Date.now() } = {}) {
  if (!isUsablePwaInfo(pwaInfo)) return false

  try {
    store.set(STORAGE_KEYS.pwaInfoCache, {
      version: PWA_INFO_CACHE_VERSION,
      savedAt: now,
      pwaInfo,
    })
    return true
  } catch {
    return false
  }
}
