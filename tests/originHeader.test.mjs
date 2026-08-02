import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendFrontendOriginHeader,
  getFrontendOrigin,
} from '../src/shared/api/originHeader.js'

function withWindow(windowValue, callback) {
  const originalWindow = globalThis.window
  globalThis.window = windowValue

  try {
    callback()
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window = originalWindow
    }
  }
}

test('uses the complete browser origin including protocol and port', () => {
  withWindow(
    {
      location: {
        host: 'pwa.example.com:4010',
        origin: 'https://pwa.example.com:4010',
      },
    },
    () => {
      assert.equal(getFrontendOrigin(), 'https://pwa.example.com:4010')
      assert.deepEqual(appendFrontendOriginHeader({ Accept: 'application/json' }), {
        Accept: 'application/json',
        'X-Origin': 'https://pwa.example.com:4010',
      })
    },
  )
})

test('preserves an explicitly supplied X-Origin header', () => {
  withWindow({ location: { origin: 'https://pwa.example.com' } }, () => {
    assert.deepEqual(appendFrontendOriginHeader({ 'X-Origin': 'https://override.example.com' }), {
      'X-Origin': 'https://override.example.com',
    })
  })
})

test('does not append X-Origin outside a browser runtime', () => {
  const originalWindow = globalThis.window
  delete globalThis.window

  try {
    assert.equal(getFrontendOrigin(), '')
    assert.deepEqual(appendFrontendOriginHeader({}), {})
  } finally {
    if (originalWindow !== undefined) globalThis.window = originalWindow
  }
})
