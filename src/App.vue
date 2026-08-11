<script setup>
import { nextTick, onMounted, onUnmounted, shallowRef } from 'vue'
import PwaFacebookBrowserGate from '@/components/pwa/PwaFacebookBrowserGate.vue'
import PwaInstallPage from '@/components/pwa/PwaInstallPage.vue'
import PwaIframeShell from '@/components/pwa/PwaIframeShell.vue'
import PwaPageSkeleton from '@/components/PwaPageSkeleton.vue'
import { usePwaInfo } from '@/composables/pwa/usePwaInfo'
import { capturePwaLandingAttribution } from '@/shared/analytics/pwaLandingAttribution'
import { H5_APP_URL } from '@/shared/config/env'
import { isPlayerIdentityEnabled } from '@/shared/config/playerIdentity'
import { isPlayerSessionEnabled } from '@/shared/config/playerSession'
import { resolveIsPwaShellRuntime } from '@/shared/pwa/displayMode'
import {
  isAndroidInstallIdentityHandoffRuntime,
  resolvePwaH5IdentityOrigin,
} from '@/shared/pwa/installIdentityHandoff'
import { shouldRenderPwaSurfaceImmediately } from '@/shared/pwa/pwaStartupPolicy'
import { dismissBootstrapLoading } from '@/shared/ui/bootstrapLoading'
import {
  isPlayerIdentityNavigationError,
  playerIdentityService,
} from '@/services/playerIdentity'
import { initializePwaNotificationClickTracking } from '@/services/pwaNotificationClickTracking'

const { pwaInfo, loading, hasPwaInfo, loadPwaInfo, waitForPwaInfo } = usePwaInfo({
  autoLoad: false,
})
const isShellRuntime = shallowRef(resolveIsPwaShellRuntime())
const playerSessionEnabled = isPlayerSessionEnabled()
const playerIdentityEnabled = !playerSessionEnabled && isPlayerIdentityEnabled()
const identityReady = shallowRef(!playerIdentityEnabled)
let displayModeQuery = null
let refreshPwaInfoAfterStandaloneReady = false

function applyReadyThemeColor() {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isShellRuntime.value ? '#272d39' : '#ffffff')
}

function syncStandaloneMode() {
  isShellRuntime.value = resolveIsPwaShellRuntime()
  if (identityReady.value) applyReadyThemeColor()
}

async function showReadySurface() {
  initializePwaNotificationClickTracking()
  applyReadyThemeColor()
  identityReady.value = true
  await nextTick()

  if (!isShellRuntime.value) dismissBootstrapLoading()
}

function handleStandaloneAppReady() {
  dismissBootstrapLoading()

  if (!refreshPwaInfoAfterStandaloneReady) return

  refreshPwaInfoAfterStandaloneReady = false
  void loadPwaInfo({ background: true })
}

onMounted(async () => {
  displayModeQuery = window.matchMedia?.('(display-mode: standalone)') || null
  displayModeQuery?.addEventListener?.('change', syncStandaloneMode)
  window.addEventListener('pageshow', syncStandaloneMode)

  let identityResult = null
  if (playerIdentityEnabled) {
    try {
      identityResult = await playerIdentityService.initialize()
    } catch (error) {
      if (isPlayerIdentityNavigationError(error)) return
    }
  }

  capturePwaLandingAttribution()

  try {
    const requiresInstallHandoff =
      playerIdentityEnabled &&
      !isShellRuntime.value &&
      isAndroidInstallIdentityHandoffRuntime()
    const hasReturnedInstallHandoff = identityResult?.type === 'install_pending'
    const canRenderReadySurfaceImmediately = shouldRenderPwaSurfaceImmediately({
      hasCachedPwaInfo: hasPwaInfo.value,
      hasReturnedInstallHandoff,
      hasStandaloneFallback: Boolean(String(H5_APP_URL || '').trim()),
      isStandalone: isShellRuntime.value,
      requiresInstallHandoff,
    })

    if (canRenderReadySurfaceImmediately) {
      if (isShellRuntime.value) {
        refreshPwaInfoAfterStandaloneReady = true
      }

      await showReadySurface()

      if (!isShellRuntime.value) {
        void loadPwaInfo({ background: true })
      }
      return
    }

    let loadedPwaInfo = await loadPwaInfo()

    if (!Object.keys(loadedPwaInfo || {}).length) {
      loadedPwaInfo = await waitForPwaInfo()
    }

    if (requiresInstallHandoff && !hasReturnedInstallHandoff) {
      const targetOrigin = resolvePwaH5IdentityOrigin(loadedPwaInfo, {
        fallbackUrl: H5_APP_URL,
      })
      if (targetOrigin) await playerIdentityService.prepareInstallHandoff(targetOrigin)
    }

    await showReadySurface()
  } catch (error) {
    if (isPlayerIdentityNavigationError(error)) return
    await showReadySurface()
    void loadPwaInfo({ background: true })
  }
})

onUnmounted(() => {
  displayModeQuery?.removeEventListener?.('change', syncStandaloneMode)
  window.removeEventListener('pageshow', syncStandaloneMode)
})
</script>

<template>
  <template v-if="identityReady">
    <PwaIframeShell
      v-if="isShellRuntime"
      :pwa-info="pwaInfo"
      :loading="loading"
      @app-ready="handleStandaloneAppReady"
    />
    <PwaPageSkeleton v-else-if="!hasPwaInfo" />
    <PwaInstallPage
      v-else
      :pwa-info="pwaInfo"
      :loading-info="loading"
      :load-pwa-info="loadPwaInfo"
    />
  </template>
  <PwaFacebookBrowserGate v-if="identityReady && !isShellRuntime" />
</template>
