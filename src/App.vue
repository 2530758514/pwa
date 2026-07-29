<script setup>
import { onMounted, onUnmounted, shallowRef } from 'vue'
import PwaFacebookBrowserGate from '@/components/pwa/PwaFacebookBrowserGate.vue'
import PwaInstallPage from '@/components/pwa/PwaInstallPage.vue'
import PwaIframeShell from '@/components/pwa/PwaIframeShell.vue'
import PwaPageSkeleton from '@/components/PwaPageSkeleton.vue'
import { usePwaInfo } from '@/composables/pwa/usePwaInfo'
import { resolveIsPwaStandalone } from '@/shared/pwa/displayMode'

const { pwaInfo, loading, hasPwaInfo, loadPwaInfo } = usePwaInfo()
const isStandalone = shallowRef(resolveIsPwaStandalone())
let displayModeQuery = null

function syncStandaloneMode() {
  isStandalone.value = resolveIsPwaStandalone()
}

onMounted(() => {
  displayModeQuery = window.matchMedia?.('(display-mode: standalone)') || null
  displayModeQuery?.addEventListener?.('change', syncStandaloneMode)
  window.addEventListener('pageshow', syncStandaloneMode)
})

onUnmounted(() => {
  displayModeQuery?.removeEventListener?.('change', syncStandaloneMode)
  window.removeEventListener('pageshow', syncStandaloneMode)
})
</script>

<template>
  <PwaIframeShell v-if="isStandalone" :pwa-info="pwaInfo" :loading="loading" />
  <PwaPageSkeleton v-else-if="!hasPwaInfo" />
  <PwaInstallPage
    v-else
    :pwa-info="pwaInfo"
    :loading-info="loading"
    :load-pwa-info="loadPwaInfo"
  />
  <PwaFacebookBrowserGate v-if="!isStandalone" />
</template>
