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
  const installHandoffIndex = bootstrap.indexOf(
    'await playerIdentityService.prepareInstallHandoff(targetOrigin)',
  )

  assert.ok(identityIndex >= 0)
  assert.ok(captureIndex > identityIndex)
  assert.ok(pwaInfoIndex > captureIndex)
  assert.ok(installHandoffIndex > pwaInfoIndex)
  assert.doesNotMatch(bootstrap, /ensureIdentity|h5_url|h5Url/)
  assert.match(appSource, /usePwaInfo\(\{\s*autoLoad: false,/)
})

test('uses the global identity switch for callback initialization and install handoff', () => {
  const bootstrap = getMountedBootstrapSource()

  assert.match(mainSource, /if \(!isPlayerSessionEnabled\(\) && isPlayerIdentityEnabled\(\)\)/)
  assert.match(
    bootstrap,
    /let identityResult = null\s+if \(playerIdentityEnabled\) \{[\s\S]*playerIdentityService\.initialize\(\)/,
  )
  assert.match(bootstrap, /const requiresInstallHandoff =\s*playerIdentityEnabled/)
})

test('initializes anonymous analytics on the ready surface without legacy notification tracking', () => {
  const bootstrap = getMountedBootstrapSource()
  const readySurfaceStart = appSource.indexOf('async function showReadySurface()')
  const readySurfaceEnd = appSource.indexOf('\nfunction handleStandaloneAppReady()', readySurfaceStart)
  const readySurface = appSource.slice(readySurfaceStart, readySurfaceEnd)
  const identityIndex = bootstrap.indexOf('await playerIdentityService.initialize()')
  const pwaInfoIndex = bootstrap.indexOf('await loadPwaInfo()')
  const cachedReadyIndex = bootstrap.indexOf('await showReadySurface()')
  const loadedReadyIndex = bootstrap.lastIndexOf('await showReadySurface()')

  assert.match(readySurface, /pwaAnalytics\.initialize\(\)/)
  assert.match(readySurface, /confirmed: false/)
  assert.doesNotMatch(appSource, /initializePwaNotificationClickTracking/)
  assert.ok(cachedReadyIndex > identityIndex)
  assert.ok(loadedReadyIndex > pwaInfoIndex)
  assert.doesNotMatch(mainSource, /initializePwaNotificationClickTracking/)
})

test('refreshes metadata alongside iframe startup rather than waiting for H5 registration', () => {
  const bootstrap = getMountedBootstrapSource()
  const readyHandlerStart = appSource.indexOf('function handleStandaloneAppReady()')
  const readyHandlerEnd = appSource.indexOf('\n}', readyHandlerStart) + 2
  const readyHandler = appSource.slice(readyHandlerStart, readyHandlerEnd)

  const refreshIndex = bootstrap.indexOf('void loadPwaInfo({ background: true })')
  const readyIndex = bootstrap.indexOf('await showReadySurface()')
  assert.ok(refreshIndex >= 0 && refreshIndex < readyIndex)
  assert.doesNotMatch(readyHandler, /loadPwaInfo/)
  assert.doesNotMatch(appSource, /refreshPwaInfoAfterStandaloneReady/)
})
