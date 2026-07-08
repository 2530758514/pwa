import { computed, onMounted, readonly, shallowRef } from 'vue'
import { usePwaInstallPrompt } from '@/composables/pwa/usePwaInstallPrompt'
import { pwaService } from '@/services/pwa'

function isBrowserRuntime() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined'
}

function resolveIsAppleDevice() {
  if (!isBrowserRuntime()) return false

  const userAgent = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent) || /iPad|iPhone|iPod/i.test(platform)
  const isTouchMac =
    /Macintosh|MacIntel/i.test(userAgent + platform) && navigator.maxTouchPoints > 1

  return isIOS || isTouchMac
}

function resolveIsAndroidDevice() {
  if (!isBrowserRuntime()) return false

  return /Android/i.test(`${navigator.userAgent || ''} ${navigator.platform || ''}`)
}

export function usePwaAddToHomeAction() {
  const {
    canPromptInstall,
    hasInstallPromptEvent,
    isInstalled,
    isStandalone,
    promptInstall,
    waitForInstallPrompt,
  } = usePwaInstallPrompt()
  const preparingInstall = shallowRef(false)
  const nativeInstalling = shallowRef(false)

  const isAppleDevice = computed(resolveIsAppleDevice)
  const isAndroidDevice = computed(resolveIsAndroidDevice)

  async function prepareInstallManifest(options = {}) {
    if (preparingInstall.value) return null

    try {
      preparingInstall.value = true

      if (options.forceRefresh) {
        return await pwaService.refreshPwaManifest({}, { persist: true })
      }

      return await pwaService.ensureCachedPwaManifest({})
    } catch {
      return null
    } finally {
      preparingInstall.value = false
    }
  }

  async function promptNativeInstall() {
    nativeInstalling.value = true

    try {
      return await promptInstall()
    } finally {
      nativeInstalling.value = false
    }
  }

  async function requestAddToHome(options = {}) {
    if (isInstalled.value || isStandalone.value) {
      return { outcome: 'installed' }
    }

    if (isAppleDevice.value) {
      const manifestResult = await prepareInstallManifest({ forceRefresh: true })

      return {
        outcome: 'ios-guide',
        ...(manifestResult || {}),
      }
    }

    if (canPromptInstall.value) {
      return await promptNativeInstall()
    }

    const manifestResult = await prepareInstallManifest({
      forceRefresh: options.forceRefresh !== false,
    })

    if (canPromptInstall.value) {
      return {
        outcome: 'ready',
        hasInstallPromptEvent: hasInstallPromptEvent.value,
        ...(manifestResult || {}),
      }
    }

    await waitForInstallPrompt({
      waitMs: options.waitMs,
      pollMs: options.pollMs,
    })

    if (canPromptInstall.value) {
      return {
        outcome: 'ready',
        hasInstallPromptEvent: hasInstallPromptEvent.value,
        ...(manifestResult || {}),
      }
    }

    return {
      outcome: 'fallback',
      hasInstallPromptEvent: hasInstallPromptEvent.value,
      ...(manifestResult || {}),
    }
  }

  onMounted(() => {
    void prepareInstallManifest()
  })

  return {
    canPromptInstall,
    hasInstallPromptEvent,
    isAndroidDevice,
    isAppleDevice,
    isInstalled,
    isStandalone,
    nativeInstalling: readonly(nativeInstalling),
    prepareInstallManifest,
    preparingInstall: readonly(preparingInstall),
    requestAddToHome,
  }
}
