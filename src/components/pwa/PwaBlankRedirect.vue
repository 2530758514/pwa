<script setup>
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import PwaBlankBrowserGuide from './PwaBlankBrowserGuide.vue'
import { isFacebookInAppBrowserRuntime } from '@/shared/pwa/installIdentityHandoff'
import { resolveIsPwaShellRuntime } from '@/shared/pwa/displayMode'
import { resolveLandingH5Url } from '@/services/landingH5Redirect'
import { pwaAnalytics } from '@/services/pwaAnalytics'
import { useSharedPwaInfo } from '@/composables/pwa/usePwaInfo'
import { H5_APP_URL } from '@/shared/config/env'

const props = defineProps({
  pwaInfo: { type: Object, default: () => ({}) },
  statisticsReady: Boolean,
  loadPwaInfo: { type: Function, required: true },
})
const facebook = isFacebookInAppBrowserRuntime()
const { error } = useSharedPwaInfo()
const invalidTarget = shallowRef(false)
const failed = computed(() => Boolean(error.value || invalidTarget.value))
const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent + navigator.platform) ||
  (/Macintosh|MacIntel/i.test(navigator.userAgent + navigator.platform) && navigator.maxTouchPoints > 1)
let active = true
let navigating = false
let recording = null
let deadline

watch([() => props.statisticsReady, () => props.pwaInfo], async ([ready]) => {
  if (!ready || navigating) return
  recording ||= pwaAnalytics.track('landing_view', { waitForDispatch: true })
  if (facebook || resolveIsPwaShellRuntime()) return
  const raw = String(props.pwaInfo.h5_url || props.pwaInfo.h5Url || H5_APP_URL || '').trim()
  const destination = resolveLandingH5Url(raw, props.pwaInfo, isApple)
  try {
    if (!raw) throw new Error('missing_target')
    const url = new URL(destination)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.origin === location.origin && url.pathname === location.pathname)) throw new Error('invalid_target')
  } catch {
    invalidTarget.value = true
    return
  }
  invalidTarget.value = false
  navigating = true
  try {
    await Promise.race([recording, new Promise(resolve => { deadline = setTimeout(resolve, 200) })])
  } catch { /* Telemetry must not block navigation. */ }
  finally { clearTimeout(deadline) }
  if (active && !resolveIsPwaShellRuntime()) window.location.replace(destination)
}, { immediate: true })

async function retry() {
  invalidTarget.value = false
  await props.loadPwaInfo({ force: true })
}
onBeforeUnmount(() => { active = false; clearTimeout(deadline) })
</script>

<template>
  <PwaBlankBrowserGuide v-if="facebook" :amount="pwaInfo.downloadRewardAmount ?? pwaInfo.download_reward_amount ?? ''" :confirmed="statisticsReady" />
  <div v-else-if="failed" role="alert" class="blank-redirect-error">
    <p>Unable to connect. Please try again.</p>
    <button type="button" @click="retry">Retry</button>
  </div>
</template>

<style scoped>
.blank-redirect-error { padding: 24px; text-align: center; color: #202124; }
.blank-redirect-error button { min-height: 44px; padding: 8px 24px; cursor: pointer; }
</style>
