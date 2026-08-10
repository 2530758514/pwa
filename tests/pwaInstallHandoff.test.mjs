import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { createDelayedRedirect } from '../src/shared/pwa/delayedRedirect.js'

const serviceSource = readFileSync(
  new URL('../src/services/playerIdentity.js', import.meta.url),
  'utf8',
)
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const shellSource = readFileSync(
  new URL('../src/components/pwa/PwaIframeShell.vue', import.meta.url),
  'utf8',
)
const installPageSource = readFileSync(
  new URL('../src/components/pwa/PwaInstallPage.vue', import.meta.url),
  'utf8',
)
const installedOpenPopupSource = readFileSync(
  new URL('../src/components/pwa/PwaInstalledOpenPopup.vue', import.meta.url),
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

function createMemoryStorage(initialState = {}) {
  const values = new Map(Object.entries(initialState))

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
  }
}

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
  assert.doesNotMatch(appReadySource, /completePlayerIdentityInstallHandoff/)
})

test('installed shell distinguishes code-acquired installs from legacy installs', () => {
  const resolverStart = serviceSource.indexOf('async function resolveHandoffRequestInternal')
  const resolverEnd = serviceSource.indexOf('\nexport const playerIdentityService', resolverStart)
  const resolverSource = serviceSource.slice(resolverStart, resolverEnd)

  assert.doesNotMatch(resolverSource, /navigate\(createCenterUrl\(flow\)\)/)
  assert.match(resolverSource, /identity_install_handoff_missing/)
  assert.match(
    resolverSource,
    /readInstallHandoffFlow\(\)[\s\S]*readAcquiredInstallHandoff\(\)[\s\S]*readCompletedInstallHandoff\(\)/,
  )
  assert.match(serviceSource, /writeAcquiredInstallHandoff\(\{/)
  assert.match(
    serviceSource,
    /writeCompletedInstallHandoff\(\{[\s\S]*clearPendingInstallHandoff\(\)[\s\S]*clearAcquiredInstallHandoff\(\)/,
  )
  assert.match(
    resolverSource,
    /if \(!isValidPendingInstallHandoff\(pendingInstallHandoff\)\) \{\s+clearPendingInstallHandoff\(\)/,
  )
  assert.match(bridgeSource, /parsePlayerIdentityHandoffConsumed\(event\.data\)/)
  assert.match(bridgeSource, /completeInstallHandoff\(consumed\)/)
  assert.doesNotMatch(shellSource, /completePlayerIdentityInstallHandoffForIframe/)
})

test('landing and installed startup cannot remain globally blocked after a recoverable identity error', () => {
  assert.match(appSource, /if \(isPlayerIdentityNavigationError\(error\)\) return/)
  assert.match(
    appSource,
    /catch \(error\) \{\s+if \(isPlayerIdentityNavigationError\(error\)\) return\s+await showReadySurface\(\)\s+void loadPwaInfo\(\{ background: true \}\)/,
  )
  assert.doesNotMatch(appSource, /if \(isPlayerIdentityError\(error\)\) return/)
})

test('landing discards an unusable acquired package before starting a fresh center flow', () => {
  const prepareStart = serviceSource.indexOf('async function prepareInstallHandoffInternal')
  const prepareEnd = serviceSource.indexOf('\nasync function resolveHandoffRequestInternal', prepareStart)
  const prepareSource = serviceSource.slice(prepareStart, prepareEnd)

  assert.match(
    prepareSource,
    /if \(pending\) \{\s+clearPendingInstallHandoff\(\)\s+clearAcquiredInstallHandoff\(\)\s+clearInstallHandoffFlow\(\)/,
  )
  assert.match(
    prepareSource,
    /const acquired = readAcquiredInstallHandoff\(\)[\s\S]*if \(acquired\) \{\s+clearAcquiredInstallHandoff\(\)/,
  )
})

test('installed shell retries a strict parent-ready message until H5 starts the handoff', () => {
  assert.match(shellSource, /const PARENT_READY_RETRY_INTERVAL_MS = 500/)
  assert.match(shellSource, /const PARENT_READY_RETRY_LIMIT = 20/)
  assert.match(shellSource, /function schedulePlayerIdentityParentReady\(\)/)
  assert.match(shellSource, /schedulePlayerIdentityParentReady\(\)\s+scheduleIframeReadyFallback\(\)/)
  assert.match(
    shellSource,
    /handlePlayerIdentityIframeMessage\([\s\S]*?\)\s+\{\s+clearPlayerIdentityParentReadyRetries\(\)/,
  )
  assert.match(bridgeSource, /iframeWindow\.postMessage\(createPlayerIdentityParentReady\(\), targetOrigin\)/)
  assert.doesNotMatch(bridgeSource, /postMessage\([^\n]+, ['"]\*['"]\)/)
})

test('installed shell pins one matching H5 iframe URL for the entire launch', () => {
  assert.match(shellSource, /const launchBaseIframeSrc = shallowRef\(''\)/)
  assert.match(shellSource, /resolveInstallIdentityTargetOrigin\(\{/)
  assert.match(shellSource, /completed: readCompletedInstallHandoff\(\)/)
  assert.match(shellSource, /isValidPendingInstallHandoff\(pendingInstallHandoff\)/)
  assert.match(shellSource, /function lockLaunchBaseIframeSrc\(\)/)
  assert.match(
    shellSource,
    /if \(launchBaseIframeSrc\.value\) return[\s\S]*pinInstallIdentityUrlToOrigin\(sourceUrl/,
  )
  assert.match(
    shellSource,
    /launchBaseIframeSrc\.value = resolveIframeUrl\(identitySourceUrl, props\.pwaInfo\)/,
  )
  assert.match(shellSource, /\{ immediate: true \}/)
})

test('identity-enabled shell never reveals an unauthenticated iframe on a timer', () => {
  const fallbackStart = shellSource.indexOf('function scheduleIframeReadyFallback()')
  const fallbackEnd = shellSource.indexOf('\nfunction reload()', fallbackStart)
  const fallbackSource = shellSource.slice(fallbackStart, fallbackEnd)

  assert.match(fallbackSource, /if \(iframeAppReady\.value \|\| playerIdentityEnabled\) return/)
  assert.match(fallbackSource, /revealIframe\(\)/)
})

test('Cookie Session shell starts the iframe reveal fallback before load fires', () => {
  assert.match(
    shellSource,
    /watch\(\s*iframeSrc,[\s\S]*if \(sourceUrl\) scheduleIframeReadyFallback\(\)[\s\S]*\{ immediate: true \}/,
  )
})

test('Android shows a persistent Open popup and falls back to H5 only while landing stays visible', () => {
  const openHandlerStart = installPageSource.indexOf('function handleInstalledOpen()')
  const openHandlerEnd = installPageSource.indexOf(
    'function handleInstalledPopupClose()',
    openHandlerStart,
  )
  const openHandlerSource = installPageSource.slice(openHandlerStart, openHandlerEnd)
  const launchHandlerStart = installPageSource.indexOf('function tryOpenInstalledPwaFromLanding()')
  const launchHandlerEnd = installPageSource.indexOf(
    'function shouldAttemptInstalledPwaOpen()',
    launchHandlerStart,
  )
  const launchHandlerSource = installPageSource.slice(launchHandlerStart, launchHandlerEnd)

  assert.match(installPageSource, /const INSTALLED_OPEN_POPUP_DELAY_MS = 12000/)
  assert.match(installPageSource, /const OPEN_H5_FALLBACK_DELAY_MS = 5000/)
  assert.match(installPageSource, /const OPEN_APP_BACKGROUND_CONFIRM_MS = 1500/)
  assert.match(installPageSource, /const OPEN_APP_RETRY_INTERVAL_MS = 1000/)
  assert.doesNotMatch(installPageSource, /scheduleAndroidPostInstallAutoOpenRetries/)
  assert.doesNotMatch(installPageSource, /schedulePostInstallH5Fallback/)
  assert.doesNotMatch(installPageSource, /usePwaLaunchReturnFallback/)
  assert.match(openHandlerSource, /tryOpenInstalledPwaFromLanding\(\)/)
  assert.match(
    openHandlerSource,
    /scheduleOpenH5Fallback\(\)[\s\S]*tryOpenInstalledPwaFromLanding\(\)/,
  )
  assert.doesNotMatch(openHandlerSource, /showInstalledOpenPopup\.value = false/)
  assert.doesNotMatch(openHandlerSource, /clearPendingInstalledOpenPopup\(\)/)
  assert.match(installPageSource, /window\.location\.replace\(targetUrl\)/)
  assert.match(installPageSource, /const OPEN_H5_FALLBACK_SESSION_KEY =/)
  assert.match(installPageSource, /function restorePendingOpenH5Fallback\(options = \{\}\)/)
  assert.match(
    installPageSource,
    /function handlePostInstallPageVisible\(\) \{[\s\S]*document\.visibilityState === 'hidden'[\s\S]*confirmOpenAppBackgroundLaunch\(\)[\s\S]*restorePendingOpenH5Fallback\(\)[\s\S]*runPendingOpenH5Fallback\(\)/,
  )
  assert.match(
    installPageSource,
    /function confirmOpenAppBackgroundLaunch\(\) \{[\s\S]*openH5RedirectController\?\.dispose\(\)[\s\S]*document\.visibilityState === 'hidden'[\s\S]*clearPendingOpenH5Fallback\(\)/,
  )
  assert.match(installPageSource, /restorePendingOpenH5Fallback\(\{ immediate: true \}\)/)
  assert.match(launchHandlerSource, /fallback: false/)
  assert.match(launchHandlerSource, /intentBrowserFallback: false/)
  assert.doesNotMatch(launchHandlerSource, /fallbackUrl|fallbackDelay|fallbackTopLevel/)
  assert.match(installPageSource, /scheduleOpenAppRetries\(launchMode\)/)
  assert.match(
    installPageSource,
    /document\.addEventListener\('visibilitychange', handleOpenAppVisibilityChange\)/,
  )
  assert.match(installPageSource, /window\.addEventListener\('pagehide', handleOpenAppPageHide\)/)
  assert.match(
    installPageSource,
    /function handleOpenAppVisibilityChange\(\) \{\s+if \(document\.visibilityState === 'hidden'\) \{\s+clearOpenAppRetryTimer\(\)/,
  )
  assert.match(
    launchHandlerSource,
    /scheduleOpenAppRetries\(launchMode\)[\s\S]*const result = tryOpenInstalledPwa\(/,
  )
  assert.match(
    installPageSource,
    /if \(shouldAttemptInstalledPwaOpen\(\)\) \{\s+tryOpenInstalledPwaFromLanding\(\)/,
  )
  assert.doesNotMatch(installedOpenPopupSource, /Open Web Page|installedOpen\.web|emit\('web'\)/)
  assert.match(installedOpenPopupSource, /visible\.value = false\s+emit\('close'\)/)
  assert.match(installPageSource, /@close="handleInstalledPopupClose"/)
  assert.match(
    launchSource,
    /const path = `\$\{launchUrl\.host\}\$\{launchUrl\.pathname\}\$\{launchUrl\.search\}`/,
  )
  assert.doesNotMatch(launchSource, /launchUrl\.search\}\$\{launchUrl\.hash\}/)
  assert.match(launchSource, /return \{ outcome: 'attempted', cancelFallback \}/)
  assert.match(launchSource, /options\.intentBrowserFallback === false/)
  assert.match(
    launchSource,
    /function handleLaunchDetected\(\) \{\s+cleanup\(\)\s+options\.onLaunchDetected\?\.\(\)/,
  )
  assert.doesNotMatch(launchSource, /launchLeftPage = false/)
})

test('Open H5 fallback resets on repeated clicks and redirects when the wake attempt stays visible', () => {
  const storageKey = 'pwa:open-h5-fallback-pending-v2'
  const storage = createMemoryStorage()
  const timers = new Map()
  const clearedTimers = []
  const navigations = []
  let currentTime = 1000
  let nextTimerId = 0

  const createController = () =>
    createDelayedRedirect({
      delayMs: 5000,
      storageKey,
      storage,
      resolveTargetUrl: () => 'https://h5.example.com/?fbclid=click-1',
      navigate: (targetUrl) => navigations.push(targetUrl),
      now: () => currentTime,
      setTimer: (callback, timeout) => {
        nextTimerId += 1
        timers.set(nextTimerId, { callback, timeout })
        return nextTimerId
      },
      clearTimer: (timerId) => clearedTimers.push(timerId),
    })

  const firstController = createController()
  assert.equal(firstController.schedule(), true)
  assert.equal(timers.get(1).timeout, 5000)

  currentTime = 1500
  assert.equal(firstController.schedule(), true)
  assert.deepEqual(clearedTimers, [1])
  assert.equal(JSON.parse(storage.getItem(storageKey)).dueAt, 6500)
  assert.equal(
    JSON.parse(storage.getItem(storageKey)).targetUrl,
    'https://h5.example.com/?fbclid=click-1',
  )

  currentTime = 6500
  timers.get(2).callback()

  assert.deepEqual(navigations, ['https://h5.example.com/?fbclid=click-1'])
  assert.equal(storage.getItem(storageKey), null)
})

test('Open H5 fallback survives a failed Intent reload without needing PWA detail again', () => {
  const storageKey = 'pwa:open-h5-fallback-pending-v2'
  const storage = createMemoryStorage()
  const navigations = []
  let currentTime = 1000

  const firstController = createDelayedRedirect({
    delayMs: 5000,
    storageKey,
    storage,
    resolveTargetUrl: () => 'https://h5.example.com/?fbclid=click-1',
    navigate: (targetUrl) => navigations.push(targetUrl),
    now: () => currentTime,
    setTimer: () => 1,
    clearTimer: () => {},
  })
  assert.equal(firstController.schedule(), true)
  firstController.dispose()

  currentTime = 1200
  const restoredController = createDelayedRedirect({
    delayMs: 5000,
    storageKey,
    storage,
    resolveTargetUrl: () => '',
    navigate: (targetUrl) => navigations.push(targetUrl),
    now: () => currentTime,
    setTimer: () => 2,
    clearTimer: () => {},
  })

  assert.equal(restoredController.restore({ immediate: true }), true)
  assert.deepEqual(navigations, ['https://h5.example.com/?fbclid=click-1'])
  assert.equal(storage.getItem(storageKey), null)
})

test('Open H5 fallback is cancelled when the PWA wake sends the page to the background', () => {
  const storageKey = 'pwa:open-h5-fallback-pending-v2'
  const storage = createMemoryStorage()
  const navigations = []
  let scheduledCallback = null

  const controller = createDelayedRedirect({
    delayMs: 5000,
    storageKey,
    storage,
    resolveTargetUrl: () => 'https://h5.example.com/',
    navigate: (targetUrl) => navigations.push(targetUrl),
    now: () => 1000,
    setTimer: (callback) => {
      scheduledCallback = callback
      return 1
    },
    clearTimer: () => {
      scheduledCallback = null
    },
  })

  assert.equal(controller.schedule(), true)
  controller.clearPending()

  assert.equal(scheduledCallback, null)
  assert.equal(storage.getItem(storageKey), null)
  assert.equal(controller.restore(), false)
  assert.deepEqual(navigations, [])
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
