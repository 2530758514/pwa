<script setup>
import { onMounted, onUnmounted, shallowRef } from 'vue'
import PlayerIdentityLoading from '@/components/identity/PlayerIdentityLoading.vue'
import PwaFacebookBrowserGate from '@/components/pwa/PwaFacebookBrowserGate.vue'
import PwaInstallPage from '@/components/pwa/PwaInstallPage.vue'
import PwaIframeShell from '@/components/pwa/PwaIframeShell.vue'
import PwaPageSkeleton from '@/components/PwaPageSkeleton.vue'
import { usePwaInfo } from '@/composables/pwa/usePwaInfo'
import { capturePwaLandingAttribution } from '@/shared/analytics/pwaLandingAttribution'
import { resolveIsPwaStandalone } from '@/shared/pwa/displayMode'
import { isPlayerIdentityError, playerIdentityService } from '@/services/playerIdentity'
import { initializePwaNotificationClickTracking } from '@/services/pwaNotificationClickTracking'

const { pwaInfo, loading, hasPwaInfo, loadPwaInfo } = usePwaInfo({
  autoLoad: false,
})
const isStandalone = shallowRef(resolveIsPwaStandalone())
const identityReady = shallowRef(false)
let displayModeQuery = null

function applyReadyThemeColor() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff')
}

function syncStandaloneMode() {
  isStandalone.value = resolveIsPwaStandalone()
}

onMounted(async () => {
  displayModeQuery = window.matchMedia?.('(display-mode: standalone)') || null
  displayModeQuery?.addEventListener?.('change', syncStandaloneMode)
  window.addEventListener('pageshow', syncStandaloneMode)

  try {
    await playerIdentityService.initialize()
    capturePwaLandingAttribution()
    await loadPwaInfo()
    initializePwaNotificationClickTracking()
    applyReadyThemeColor()
    identityReady.value = true
  } catch (error) {
    if (isPlayerIdentityError(error)) return
    // Keep the neutral loading surface for unexpected bootstrap failures too.
  }
})

onUnmounted(() => {
  displayModeQuery?.removeEventListener?.('change', syncStandaloneMode)
  window.removeEventListener('pageshow', syncStandaloneMode)
})
</script>

<template>
  <PlayerIdentityLoading v-if="!identityReady" />
  <PwaIframeShell v-else-if="isStandalone" :pwa-info="pwaInfo" :loading="loading" />
  <PwaPageSkeleton v-else-if="!hasPwaInfo" />
  <PwaInstallPage v-else :pwa-info="pwaInfo" :loading-info="loading" :load-pwa-info="loadPwaInfo" />
  <PwaFacebookBrowserGate v-if="identityReady && !isStandalone" />
</template>
