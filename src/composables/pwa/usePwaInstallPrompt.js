import { computed, onMounted, onUnmounted, readonly, shallowRef } from 'vue'
import { STORAGE_KEYS } from '@/shared/storage/keys'
import { storage } from '@/shared/storage/storage'
import {
  getCurrentPwaManifestHref,
  isDefaultPwaManifestHref,
  PWA_MANIFEST_HREF_CHANGE_EVENT,
} from '@/shared/pwa/manifest'

const deferredPrompt = shallowRef(null)
const deferredPromptManifestHref = shallowRef('')
const isInstalled = shallowRef(false)
const isStandalone = shallowRef(false)
const hasInstallPromptEvent = shallowRef(false)
const DEFAULT_INSTALL_PROMPT_WAIT_MS = 1600
const DEFAULT_INSTALL_PROMPT_POLL_MS = 120
let listenersRegistered = false
let consumerCount = 0
let shouldKeepListenersRegistered = false
let displayModeQuery = null
let installStateRefreshPromise = null

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function readStoredInstallState() {
  const installState = storage.get(STORAGE_KEYS.pwaInstallState, null)

  if (installState === true) return { installed: true }
  if (!installState || typeof installState !== 'object') return null

  return installState.installed ? installState : null
}

function writeStoredInstallState(source) {
  storage.set(STORAGE_KEYS.pwaInstallState, {
    installed: true,
    source,
    installedAt: Date.now(),
  })
}

function clearStoredInstallState() {
  storage.remove(STORAGE_KEYS.pwaInstallState)
}

function markInstalled(source) {
  isInstalled.value = true
  deferredPrompt.value = null
  deferredPromptManifestHref.value = ''
  writeStoredInstallState(source)
}

function clearDeferredPrompt() {
  deferredPrompt.value = null
  deferredPromptManifestHref.value = ''
}

function resolveIsDeferredPromptStale(options = {}) {
  if (!deferredPrompt.value) return false

  const capturedManifestHref = deferredPromptManifestHref.value
  const currentManifestHref = getCurrentPwaManifestHref()

  if (options.rejectDefaultManifest && isDefaultPwaManifestHref(capturedManifestHref)) {
    return true
  }

  return Boolean(capturedManifestHref && currentManifestHref && capturedManifestHref !== currentManifestHref)
}

function discardStaleInstallPrompt(options = {}) {
  if (!resolveIsDeferredPromptStale(options)) return false

  clearDeferredPrompt()

  return true
}

function resolveStandaloneMode() {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator?.standalone === true
  )
}

function resolveIosInstallGuide() {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent)
  const isSafari = /Safari/i.test(userAgent)
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent)

  return isIOS && isSafari && !isOtherIosBrowser
}

function syncStandaloneMode() {
  isStandalone.value = resolveStandaloneMode()
  if (isStandalone.value) {
    markInstalled('standalone')
  }
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault()
  clearStoredInstallState()
  isInstalled.value = false
  hasInstallPromptEvent.value = true
  deferredPrompt.value = event
  deferredPromptManifestHref.value = getCurrentPwaManifestHref()
}

function handleAppInstalled() {
  markInstalled('appinstalled')
}

function hasStoredInstallState() {
  return Boolean(readStoredInstallState())
}

function isInstalledRelatedWebApp(app) {
  if (!app || typeof app !== 'object') return false

  return app.platform === 'webapp' || app.platform === 'web'
}

async function checkInstalledRelatedApps() {
  if (typeof navigator === 'undefined' || typeof navigator.getInstalledRelatedApps !== 'function') {
    return false
  }

  try {
    const relatedApps = await navigator.getInstalledRelatedApps()

    return Array.isArray(relatedApps) && relatedApps.some(isInstalledRelatedWebApp)
  } catch {
    return false
  }
}

async function refreshInstalledState() {
  if (installStateRefreshPromise) return installStateRefreshPromise

  installStateRefreshPromise = (async () => {
    syncStandaloneMode()

    if (isStandalone.value || isInstalled.value) return isInstalled.value

    if (deferredPrompt.value) {
      discardStaleInstallPrompt()
    }

    if (deferredPrompt.value) {
      clearStoredInstallState()
      return false
    }

    if (await checkInstalledRelatedApps()) {
      markInstalled('related-apps')
      return true
    }

    if (hasStoredInstallState()) {
      isInstalled.value = true
      deferredPrompt.value = null
      return true
    }

    return false
  })().finally(() => {
    installStateRefreshPromise = null
  })

  return installStateRefreshPromise
}

function handlePageShow() {
  void refreshInstalledState()
}

function handleManifestHrefChange() {
  discardStaleInstallPrompt()
}

function registerListeners() {
  if (listenersRegistered || typeof window === 'undefined') return

  void refreshInstalledState()
  displayModeQuery = window.matchMedia?.('(display-mode: standalone)') || null
  displayModeQuery?.addEventListener?.('change', syncStandaloneMode)
  window.addEventListener('pageshow', handlePageShow)
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
  window.addEventListener(PWA_MANIFEST_HREF_CHANGE_EVENT, handleManifestHrefChange)
  listenersRegistered = true
}

function unregisterListeners() {
  if (
    !listenersRegistered ||
    shouldKeepListenersRegistered ||
    consumerCount > 0 ||
    typeof window === 'undefined'
  ) {
    return
  }

  displayModeQuery?.removeEventListener?.('change', syncStandaloneMode)
  window.removeEventListener('pageshow', handlePageShow)
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
  window.removeEventListener(PWA_MANIFEST_HREF_CHANGE_EVENT, handleManifestHrefChange)
  listenersRegistered = false
  displayModeQuery = null
}

export function initializePwaInstallPromptListeners() {
  shouldKeepListenersRegistered = true
  registerListeners()
}

export function usePwaInstallPrompt() {
  const canPromptInstall = computed(() => {
    return Boolean(deferredPrompt.value) && !isInstalled.value && !isStandalone.value
  })

  const isIosInstallGuide = computed(() => {
    return resolveIosInstallGuide() && !isInstalled.value && !isStandalone.value
  })

  async function promptInstall() {
    discardStaleInstallPrompt()
    await refreshInstalledState()

    if (!deferredPrompt.value || isInstalled.value || isStandalone.value) {
      return { outcome: isInstalled.value || isStandalone.value ? 'installed' : 'unavailable' }
    }

    const promptEvent = deferredPrompt.value

    try {
      const promptResult = await promptEvent.prompt()
      const choice = promptResult?.outcome ? promptResult : await promptEvent.userChoice
      const outcome = choice?.outcome || 'unknown'

      deferredPrompt.value = null
      deferredPromptManifestHref.value = ''

      if (outcome === 'accepted') {
        markInstalled('prompt-accepted')
      }

      return { outcome }
    } catch (error) {
      return {
        outcome: 'failed',
        error,
      }
    }
  }

  async function waitForInstallPrompt(options = {}) {
    discardStaleInstallPrompt(options)
    await refreshInstalledState()

    if (canPromptInstall.value || typeof window === 'undefined') {
      return canPromptInstall.value
    }

    const waitMs = Number.isFinite(options.waitMs)
      ? options.waitMs
      : DEFAULT_INSTALL_PROMPT_WAIT_MS
    const pollMs = Number.isFinite(options.pollMs)
      ? options.pollMs
      : DEFAULT_INSTALL_PROMPT_POLL_MS
    const deadline = Date.now() + waitMs

    while (Date.now() < deadline) {
      await sleep(pollMs)
      discardStaleInstallPrompt(options)

      if (canPromptInstall.value) return true
    }

    return false
  }

  onMounted(() => {
    consumerCount += 1
    registerListeners()
  })

  onUnmounted(() => {
    consumerCount = Math.max(consumerCount - 1, 0)
    unregisterListeners()
  })

  return {
    canPromptInstall,
    hasInstallPromptEvent: readonly(hasInstallPromptEvent),
    isInstalled: readonly(isInstalled),
    isIosInstallGuide,
    isStandalone: readonly(isStandalone),
    promptInstall,
    discardStaleInstallPrompt,
    refreshInstalledState,
    waitForInstallPrompt,
  }
}
