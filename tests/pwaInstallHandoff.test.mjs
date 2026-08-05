import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const serviceSource = readFileSync(
  new URL('../src/services/playerIdentity.js', import.meta.url),
  'utf8',
)
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const shellSource = readFileSync(
  new URL('../src/components/pwa/PwaIframeShell.vue', import.meta.url),
  'utf8',
)
const bridgeSource = readFileSync(
  new URL('../src/services/playerIdentityIframeBridge.js', import.meta.url),
  'utf8',
)
const installSource = readFileSync(
  new URL('../src/composables/pwa/usePwaAddToHomeAction.js', import.meta.url),
  'utf8',
)
const launchSource = readFileSync(
  new URL('../src/composables/pwa/usePwaLaunchAction.js', import.meta.url),
  'utf8',
)

test('Android landing startup prepares identity before the native install action', () => {
  assert.doesNotMatch(installSource, /playerIdentity|handoff|manifestOverrides/)
  assert.doesNotMatch(launchSource, /handoff|pwa_handoff_code/)
  assert.match(appSource, /isAndroidInstallIdentityHandoffRuntime\(\)/)
  assert.match(appSource, /playerIdentityService\.prepareInstallHandoff\(targetOrigin\)/)
  assert.doesNotMatch(serviceSource, /web_token_create|web_refresh_register/)
  assert.doesNotMatch(serviceSource, /h5_url|h5Url/)
})

test('installed shell defers notification permission until the H5 app is ready', () => {
  const mountedStart = shellSource.indexOf('onMounted(() => {')
  const mountedEnd = shellSource.indexOf('onUnmounted(() => {')
  const mountedSource = shellSource.slice(mountedStart, mountedEnd)
  const appReadyStart = shellSource.indexOf('if (isPwaH5AppReadyMessage(event.data))')
  const appReadyEnd = shellSource.indexOf('\n  if (', appReadyStart + 1)
  const appReadySource = shellSource.slice(appReadyStart, appReadyEnd)

  assert.doesNotMatch(mountedSource, /requestAndroidNotificationPermission\(\)/)
  assert.match(appReadySource, /scheduleAndroidNotificationPermission\(\)/)
})

test('PWA authorization uses its own Origin as the source Client', () => {
  assert.match(serviceSource, /createAutomaticClientId\(window\.location\.origin\)/)
  assert.match(serviceSource, /url\.searchParams\.set\('flow', 'handoff'\)/)
  assert.match(serviceSource, /url\.searchParams\.set\('source_client_id', flow\.sourceClientId\)/)
  assert.match(serviceSource, /url\.searchParams\.set\('target_client_id', flow\.targetClientId\)/)
})

test('disabled identity rollout bypasses the installed iframe handoff bridge', () => {
  assert.match(bridgeSource, /if \(!isPlayerIdentityEnabled\(\)\) return false/)
  assert.match(serviceSource, /if \(!isPlayerIdentityEnabled\(\)\) return null/)
})
