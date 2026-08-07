import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PWA_INFO_CACHE_MAX_AGE_MS,
  readPwaInfoCache,
  writePwaInfoCache,
} from '../src/shared/pwa/pwaInfoCache.js'

function createMemoryStore() {
  const values = new Map()

  return {
    get(key, fallback = null) {
      return values.has(key) ? values.get(key) : fallback
    },
    set(key, value) {
      values.set(key, value)
    },
  }
}

test('stores and restores fresh PWA detail data', () => {
  const store = createMemoryStore()
  const pwaInfo = { pwaId: 17, h5Url: 'https://h5.example.com/' }

  assert.equal(writePwaInfoCache(pwaInfo, { store, now: 1000 }), true)
  assert.deepEqual(readPwaInfoCache({ store, now: 2000 }), {
    pwaInfo,
    savedAt: 1000,
  })
})

test('rejects expired or empty PWA detail cache records', () => {
  const store = createMemoryStore()

  assert.equal(writePwaInfoCache({}, { store, now: 1000 }), false)
  assert.equal(writePwaInfoCache({ pwaId: 17 }, { store, now: 1000 }), true)
  assert.equal(
    readPwaInfoCache({ store, now: 1000 + PWA_INFO_CACHE_MAX_AGE_MS + 1 }),
    null,
  )
})

test('allows an installed PWA to reuse an expired detail record as a startup fallback', () => {
  const store = createMemoryStore()
  const pwaInfo = { pwaId: 17, h5Url: 'https://h5.example.com/' }

  writePwaInfoCache(pwaInfo, { store, now: 1000 })

  assert.deepEqual(
    readPwaInfoCache({
      store,
      now: 1000 + PWA_INFO_CACHE_MAX_AGE_MS + 1,
      maxAgeMs: Number.POSITIVE_INFINITY,
    })?.pwaInfo,
    pwaInfo,
  )
})
