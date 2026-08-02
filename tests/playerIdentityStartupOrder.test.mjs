import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

function getMountedBootstrapSource() {
  const start = appSource.indexOf('onMounted(async () => {')
  const end = appSource.indexOf('onUnmounted(() => {', start)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  return appSource.slice(start, end)
}

test('captures a PWA callback before loading pwa_h5_detail and the iframe', () => {
  const bootstrap = getMountedBootstrapSource()
  const identityIndex = bootstrap.indexOf('await playerIdentityService.initialize()')
  const captureIndex = bootstrap.indexOf('capturePwaLandingAttribution()')
  const pwaInfoIndex = bootstrap.indexOf('await loadPwaInfo()')

  assert.ok(identityIndex >= 0)
  assert.ok(captureIndex > identityIndex)
  assert.ok(pwaInfoIndex > captureIndex)
  assert.doesNotMatch(bootstrap, /ensureIdentity|h5_url|h5Url/)
  assert.match(appSource, /usePwaInfo\(\{\s*autoLoad: false,/)
})

test('starts notification click requests only after identity and PWA info are ready', () => {
  const bootstrap = getMountedBootstrapSource()
  const pwaInfoIndex = bootstrap.indexOf('await loadPwaInfo()')
  const notificationIndex = bootstrap.indexOf('initializePwaNotificationClickTracking()')

  assert.ok(notificationIndex > pwaInfoIndex)
  assert.doesNotMatch(mainSource, /initializePwaNotificationClickTracking/)
})
