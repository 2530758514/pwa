import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { normalizeFacebookPixels } from '../src/models/pwa.js'

test('normalizes and deduplicates facebook_pixels from pwa_h5_detail', () => {
  assert.deepEqual(
    normalizeFacebookPixels([
      { config_id: 2, pixel_id: ' 123 ' },
      { config_id: 3, pixel_id: '123' },
      { config_id: 4, pixel_id: '456' },
      { config_id: 5, pixel_id: '' },
    ]),
    [
      { configId: 2, pixelId: '123' },
      { configId: 4, pixelId: '456' },
    ],
  )
})

test('wires install and shell launch to separate Facebook events', () => {
  const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const installPage = readFileSync(
    new URL('../src/components/pwa/PwaInstallPage.vue', import.meta.url),
    'utf8',
  )
  const pixel = readFileSync(
    new URL('../src/shared/analytics/facebookPixel.js', import.meta.url),
    'utf8',
  )

  assert.match(app, /reportFacebookPwaLaunch/)
  assert.match(installPage, /reportFacebookPwaInstall/)
  assert.match(pixel, /trackSingleCustom', pixelId, 'PWAInstall'/)
  assert.match(pixel, /trackSingleCustom', pixelId, 'PWALaunch'/)
  assert.doesNotMatch(pixel, /PageView/)
  assert.match(app, /Facebook reporting is best effort and must never block shell startup/)
  assert.match(installPage, /Facebook reporting is best effort and must never block the native prompt/)
})
