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

test('starts notification click requests only after identity and PWA info are ready', () => {
  const bootstrap = getMountedBootstrapSource()
  const readySurfaceStart = appSource.indexOf('async function showReadySurface()')
  const readySurfaceEnd = appSource.indexOf('\nfunction handleStandaloneAppReady()', readySurfaceStart)
  const readySurface = appSource.slice(readySurfaceStart, readySurfaceEnd)
  const identityIndex = bootstrap.indexOf('await playerIdentityService.initialize()')
  const pwaInfoIndex = bootstrap.indexOf('await loadPwaInfo()')
  const cachedReadyIndex = bootstrap.indexOf('await showReadySurface()')
  const loadedReadyIndex = bootstrap.lastIndexOf('await showReadySurface()')

  assert.match(readySurface, /initializePwaNotificationClickTracking\(\)/)
  assert.ok(cachedReadyIndex > identityIndex)
  assert.ok(loadedReadyIndex > pwaInfoIndex)
  assert.doesNotMatch(mainSource, /initializePwaNotificationClickTracking/)
})

test('defers cached standalone detail refresh until the H5 iframe is ready', () => {
  const bootstrap = getMountedBootstrapSource()
  const readyHandlerStart = appSource.indexOf('function handleStandaloneAppReady()')
  const readyHandlerEnd = appSource.indexOf('\n}', readyHandlerStart) + 2
  const readyHandler = appSource.slice(readyHandlerStart, readyHandlerEnd)

  assert.match(
    bootstrap,
    /if \(isShellRuntime\.value\) \{\s+refreshPwaInfoAfterStandaloneReady = true\s+\}[\s\S]*await showReadySurface\(\)[\s\S]*if \(!isShellRuntime\.value\) \{\s+void loadPwaInfo\(\{ background: true \}\)/,
  )
  assert.match(
    readyHandler,
    /dismissBootstrapLoading\(\)[\s\S]*refreshPwaInfoAfterStandaloneReady = false[\s\S]*loadPwaInfo\(\{ background: true \}\)/,
  )
})
