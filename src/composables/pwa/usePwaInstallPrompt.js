import { computed, onMounted, onUnmounted, readonly, shallowRef } from 'vue'

const deferredPrompt = shallowRef(null)
const isInstalled = shallowRef(false)
const isStandalone = shallowRef(false)
const hasInstallPromptEvent = shallowRef(false)
const DEFAULT_INSTALL_PROMPT_WAIT_MS = 1600
const DEFAULT_INSTALL_PROMPT_POLL_MS = 120
let listenersRegistered = false
let consumerCount = 0
let shouldKeepListenersRegistered = false
let displayModeQuery = null

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
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
    isInstalled.value = true
    deferredPrompt.value = null
  }
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault()
  hasInstallPromptEvent.value = true
  deferredPrompt.value = event
}

function handleAppInstalled() {
  isInstalled.value = true
  deferredPrompt.value = null
}

function registerListeners() {
  if (listenersRegistered || typeof window === 'undefined') return

  syncStandaloneMode()
  displayModeQuery = window.matchMedia?.('(display-mode: standalone)') || null
  displayModeQuery?.addEventListener?.('change', syncStandaloneMode)
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
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
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
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
    if (!deferredPrompt.value || isInstalled.value || isStandalone.value) {
      return { outcome: 'unavailable' }
    }

    const promptEvent = deferredPrompt.value

    try {
      const promptResult = await promptEvent.prompt()
      const choice = promptResult?.outcome ? promptResult : await promptEvent.userChoice

      deferredPrompt.value = null

      return { outcome: choice?.outcome || 'unknown' }
    } catch (error) {
      return {
        outcome: 'failed',
        error,
      }
    }
  }

  async function waitForInstallPrompt(options = {}) {
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
    waitForInstallPrompt,
  }
}
