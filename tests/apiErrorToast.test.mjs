import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  formatDebugApiError,
  isDebugApiErrorToastEnabled,
} from '../src/shared/debug/apiErrorToast.js'

test('enables API error toasts only for development or configured test builds', () => {
  assert.equal(isDebugApiErrorToastEnabled({ MODE: 'development', DEV: true }), true)
  assert.equal(
    isDebugApiErrorToastEnabled({
      MODE: 'test',
      VITE_ENABLE_API_ERROR_TOAST: 'true',
    }),
    true,
  )
  assert.equal(
    isDebugApiErrorToastEnabled({
      MODE: 'production',
      DEV: true,
      VITE_ENABLE_API_ERROR_TOAST: 'true',
    }),
    false,
  )
})

test('formats API failures without exposing request query parameters', () => {
  const message = formatDebugApiError({
    message: 'Not found',
    response: {
      status: 404,
      data: { code: 404 },
      config: {
        method: 'get',
        url: '/pwa_h5_detail?fbclid=secret-value',
      },
    },
  })

  assert.match(message, /^\[API\] GET \/pwa_h5_detail/m)
  assert.match(message, /HTTP 404 · API 404/)
  assert.doesNotMatch(message, /secret-value/)
})

test('keeps vConsole above the identity loading overlay', () => {
  const source = readFileSync(new URL('../src/shared/debug/vconsole.js', import.meta.url), 'utf8')

  assert.match(source, /z-index: 2147483647 !important/)
  assert.match(source, /#__vconsole \.vc-panel/)
})
