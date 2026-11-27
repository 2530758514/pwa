<script setup>
import { computed, nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import PwaFacebookBrowserGate from '@/components/pwa/PwaFacebookBrowserGate.vue'
import PwaBlankRedirect from '@/components/pwa/PwaBlankRedirect.vue'
import PwaInstallPage from '@/components/pwa/PwaInstallPage.vue'
import PwaIframeShell from '@/components/pwa/PwaIframeShell.vue'
import PwaPageSkeleton from '@/components/PwaPageSkeleton.vue'
import PwaTetrisLanding from '@/components/pwa/PwaTetrisLanding.vue'
import { usePwaInfo } from '@/composables/pwa/usePwaInfo'
import { hasFacebookUrlAttribution } from '@/shared/analytics/facebookLandingParams'
import { capturePwaLandingAttribution } from '@/shared/analytics/pwaLandingAttribution'
import { initializeFacebookPixels, reportFacebookPwaLaunch } from '@/shared/analytics/facebookPixel'
import { H5_APP_URL, SHOW_PWA_LANDING, TETRIS_LANDING_ENABLED } from '@/shared/config/env'
import { isPlayerIdentityEnabled } from '@/shared/config/playerIdentity'
import { isPlayerSessionEnabled } from '@/shared/config/playerSession'
import { resolveIsPwaShellRuntime } from '@/shared/pwa/displayMode'
import {
  isAndroidInstallIdentityHandoffRuntime,
  resolvePwaH5IdentityOrigin,
} from '@/shared/pwa/installIdentityHandoff'
import { shouldRenderPwaSurfaceImmediately } from '@/shared/pwa/pwaStartupPolicy'
import { dismissBootstrapLoading } from '@/shared/ui/bootstrapLoading'
import { isPlayerIdentityNavigationError, playerIdentityService } from '@/services/playerIdentity'
import { pwaAnalytics } from '@/services/pwaAnalytics'

const { pwaInfo, loading, hasPwaInfo, hasFreshPwaInfo, loadPwaInfo, waitForPwaInfo } = usePwaInfo({
  autoLoad: false,
})
const isShellRuntime = shallowRef(resolveIsPwaShellRuntime())
const shouldShowPwaTetrisOverlay = computed(
  () => SHOW_PWA_LANDING && TETRIS_LANDING_ENABLED && !isShellRuntime.value && !hasFacebookUrlAttribution(),
)
const playerSessionEnabled = isPlayerSessionEnabled()
const playerIdentityEnabled = !playerSessionEnabled && isPlayerIdentityEnabled()
const identityReady = shallowRef(!playerIdentityEnabled)
let displayModeQuery = null

watch(
  [pwaInfo, isShellRuntime],
  ([info, shellRuntime]) => {
    try {
      const pixels = info?.facebookPixels || []
      initializeFacebookPixels(pixels)

      if (!shellRuntime) return

      reportFacebookPwaLaunch(pixels, {
        pwa_id: info?.pwaId || '',
        pwa_url_id: info?.pwaUrlId || '',
        platform: 'android',
        install_surface: 'shell',
      })
    } catch {
      // Facebook reporting is best effort and must never block shell startup.
    }
  },
  { immediate: true },
)

function applyReadyThemeColor() {
  if (!SHOW_PWA_LANDING) document.documentElement.classList.toggle('pwa-blank-entry', !isShellRuntime.value)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isShellRuntime.value ? '#000000' : '#ffffff')
}

function syncStandaloneMode() {
  isShellRuntime.value = resolveIsPwaShellRuntime()
  if (identityReady.value) applyReadyThemeColor()
}

async function showReadySurface() {
  pwaAnalytics.initialize()
  if (hasPwaInfo.value) pwaAnalytics.updateConfig(pwaInfo.value, { confirmed: false })
  applyReadyThemeColor()
  identityReady.value = true
  await nextTick()
  pwaAnalytics.markReady()

  if (!isShellRuntime.value) dismissBootstrapLoading()
}

function handleStandaloneAppReady() {
  dismissBootstrapLoading()
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

  if (!SHOW_PWA_LANDING && !isShellRuntime.value) {
    void loadPwaInfo({ background: true })
    await showReadySurface()
    return
  }

  try {
    const requiresInstallHandoff =
      playerIdentityEnabled && !isShellRuntime.value && isAndroidInstallIdentityHandoffRuntime()
    const hasReturnedInstallHandoff = identityResult?.type === 'install_pending'
    const canRenderReadySurfaceImmediately = shouldRenderPwaSurfaceImmediately({
      hasCachedPwaInfo: hasPwaInfo.value,
      hasReturnedInstallHandoff,
      hasStandaloneFallback: Boolean(String(H5_APP_URL || '').trim()),
      isStandalone: isShellRuntime.value,
      requiresInstallHandoff,
    })

    if (canRenderReadySurfaceImmediately) {
      // Metadata runs alongside iframe startup so first registration can receive its context.
      // Do not await it: a statistics/configuration outage must not block the existing shell.
      void loadPwaInfo({ background: true })
      await showReadySurface()
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
    <PwaBlankRedirect
      v-else-if="!SHOW_PWA_LANDING"
      :pwa-info="pwaInfo"
      :statistics-ready="hasFreshPwaInfo"
      :load-pwa-info="loadPwaInfo"
    />
    <PwaPageSkeleton v-else-if="!hasPwaInfo" />
    <PwaInstallPage
      v-else
      :pwa-info="pwaInfo"
      :loading-info="loading"
      :load-pwa-info="loadPwaInfo"
      :statistics-ready="hasFreshPwaInfo"
    />
  </template>
  <PwaFacebookBrowserGate v-if="SHOW_PWA_LANDING && identityReady && !isShellRuntime && !shouldShowPwaTetrisOverlay" />
  <PwaTetrisLanding v-if="identityReady && shouldShowPwaTetrisOverlay" />
</template>
