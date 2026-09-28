import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { hasFacebookUrlAttribution } from '../src/shared/analytics/facebookLandingParams.js'

test('detects Facebook advertising parameters only from the current URL and hash', () => {
  assert.equal(hasFacebookUrlAttribution({ search: '?fbclid=click-1', hash: '' }), true)
  assert.equal(hasFacebookUrlAttribution({ search: '', hash: '#/home?x-fbp=browser-1' }), true)
  assert.equal(hasFacebookUrlAttribution({ search: '?campaign=organic', hash: '' }), false)
})

test('overlays Tetris on every non-standalone landing without current ad attribution', () => {
  const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const envSource = readFileSync(new URL('../src/shared/config/env.js', import.meta.url), 'utf8')

  assert.match(appSource, /const shouldShowPwaTetrisOverlay = computed\(/)
  assert.match(appSource, /TETRIS_LANDING_ENABLED &&/)
  assert.match(appSource, /!hasFacebookUrlAttribution\(\)/)
  assert.match(appSource, /<PwaTetrisLanding v-if="identityReady && shouldShowPwaTetrisOverlay"/)
  assert.match(appSource, /!shouldShowPwaTetrisOverlay/)
  assert.match(appSource, /!isShellRuntime\.value/)
  assert.match(envSource, /VITE_ENABLE_TETRIS_LANDING/)
  assert.match(envSource, /\?\? 'true'/)

  const tetrisSource = readFileSync(
    new URL('../src/components/pwa/PwaTetrisLanding.vue', import.meta.url),
    'utf8',
  )
  assert.match(tetrisSource, /position: fixed;/)
  assert.match(tetrisSource, /inset: 0;/)
  assert.match(tetrisSource, /overflow: hidden;/)
  assert.match(tetrisSource, /grid-template-areas:/)
  assert.match(tetrisSource, /grid-area: space;/)
  assert.match(tetrisSource, /grid-area: restart;/)
  assert.match(tetrisSource, /margin-bottom: 4px;/)
  assert.match(tetrisSource, />▲<\/button>/)
  assert.match(tetrisSource, />SPACE<\/button>/)
  assert.doesNotMatch(tetrisSource, /TAKE A BREAK|<h1/)
  assert.match(tetrisSource, /background: #283851;/)
})
