<script setup>
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { H5_APP_URL } from '@/shared/config/env'
import { t } from '@/content/pwaText'
import PlayerIdentityLoading from '@/components/identity/PlayerIdentityLoading.vue'
import PwaLoadingSpinner from '@/components/PwaLoadingSpinner.vue'
import { appendBigoAttributionParams } from '@/shared/analytics/bigoAttribution'
import { appendStoredPwaFacebookAttributionParams } from '@/shared/analytics/pwaLandingAttribution'
import { usePwaShellNotifications } from '@/composables/pwa/usePwaShellNotifications'
import {
  completePlayerIdentityInstallHandoffForIframe,
  handlePlayerIdentityIframeMessage,
  resetPlayerIdentityIframeBridge,
} from '@/services/playerIdentityIframeBridge'
import { applyPwaAppOpenParam, applyPwaIdentityParams } from '@/shared/pwa/identityParams'
import { isPwaH5AppReadyMessage } from '@/shared/pwa/iframeLifecycleMessages'
import {
  H5_NOTIFICATION_NAVIGATE,
  H5_NOTIFICATION_NAVIGATION_APPLIED,
  H5_NOTIFICATION_NAVIGATION_READY,
  PWA_SHELL_NOTIFICATION_NAVIGATE,
  clearPendingNotificationNavigation,
  normalizeNotificationNavigation,
  readPendingNotificationNavigation,
} from '@/shared/pwa/notificationNavigation'

const FALLBACK_IFRAME_HEIGHT = '100vh'
const IFRAME_READY_FALLBACK_MS = 12_000
const NOTIFICATION_PERMISSION_DELAY_MS = 600
const SHELL_ONLY_SEARCH_PARAMS = new Set(['redirect'])

defineOptions({
  name: 'PwaIframeShell',
})

const emit = defineEmits(['app-ready'])

const props = defineProps({
  pwaInfo: {
    type: Object,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const iframeViewportHeight = shallowRef(FALLBACK_IFRAME_HEIGHT)
const {
  permission: notificationPermission,
  requestPermission,
  requestSubscription,
} = usePwaShellNotifications()
const iframeRef = useTemplateRef('iframe')
const iframeReady = shallowRef(false)
const iframeAppReady = shallowRef(false)
const pendingNotificationNavigation = shallowRef(null)
const activeNotificationLocation = shallowRef('')
let pendingViewportSync = 0
let iframeReadyFallbackTimer = 0
let notificationPermissionTimer = 0
let androidPermissionGrantHandled = false

const iframeShellStyle = computed(() => ({
  '--pwa-iframe-height': iframeViewportHeight.value,
}))

function resolveIsAndroidDevice() {
  if (typeof navigator === 'undefined') return false

  return /Android/i.test(`${navigator.userAgent || ''} ${navigator.platform || ''}`)
}

function requestAndroidNotificationPermission() {
  if (!resolveIsAndroidDevice()) return

  const shouldHandlePermissionGrant = notificationPermission.value === 'default'

  // Android standalone PWA only: request the browser/system permission
  // directly, without displaying a custom explanation or guide popup.
  void requestPermission({
    promptKey: 'standalone-entry',
    allowStandalone: true,
  }).then((nextPermission) => {
    if (
      nextPermission !== 'granted' ||
      !shouldHandlePermissionGrant ||
      androidPermissionGrantHandled
    ) {
      return
    }

    androidPermissionGrantHandled = true
    void requestSubscription({ pwaInfo: props.pwaInfo })
  })
}

function clearNotificationPermissionTimer() {
  if (!notificationPermissionTimer) return

  window.clearTimeout(notificationPermissionTimer)
  notificationPermissionTimer = 0
}

function scheduleAndroidNotificationPermission() {
  clearNotificationPermissionTimer()
  notificationPermissionTimer = window.setTimeout(() => {
    notificationPermissionTimer = 0
    requestAndroidNotificationPermission()
  }, NOTIFICATION_PERMISSION_DELAY_MS)
}

function resolveIframeViewportHeight() {
  if (typeof window === 'undefined') return FALLBACK_IFRAME_HEIGHT

  const height =
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement?.clientHeight ||
    0

  return Number.isFinite(height) && height > 0 ? `${height}px` : FALLBACK_IFRAME_HEIGHT
}

function syncIframeViewportHeight() {
  if (typeof window === 'undefined') return

  if (pendingViewportSync) {
    window.cancelAnimationFrame(pendingViewportSync)
  }

  pendingViewportSync = window.requestAnimationFrame(() => {
    pendingViewportSync = 0
    iframeViewportHeight.value = resolveIframeViewportHeight()
  })
}

function applySearchParams(targetParams, sourceParams) {
  sourceParams.forEach((value, key) => {
    if (!key || SHELL_ONLY_SEARCH_PARAMS.has(key)) return

    targetParams.set(key, value)
  })
}

function resolveIframeUrl(sourceUrl, pwaInfo = {}) {
  if (typeof window === 'undefined') return sourceUrl

  try {
    const targetUrl = new URL(sourceUrl, window.location.origin)
    appendStoredPwaFacebookAttributionParams(targetUrl.searchParams)
    applySearchParams(targetUrl.searchParams, new URLSearchParams(window.location.search))

    const hashQueryIndex = window.location.hash.indexOf('?')
    if (hashQueryIndex !== -1) {
      applySearchParams(
        targetUrl.searchParams,
        new URLSearchParams(window.location.hash.slice(hashQueryIndex + 1)),
      )
    }

    applyPwaIdentityParams(targetUrl.searchParams, pwaInfo)
    appendBigoAttributionParams(targetUrl.searchParams)
    applyPwaAppOpenParam(targetUrl.searchParams)

    return targetUrl.toString()
  } catch {
    return sourceUrl
  }
}

const detailH5Url = computed(() =>
  String(props.pwaInfo?.h5_url || props.pwaInfo?.h5Url || '').trim(),
)

const baseIframeSrc = computed(() => {
  const fallbackUrl = props.loading ? '' : String(H5_APP_URL || '').trim()
  const sourceUrl = detailH5Url.value || fallbackUrl

  return sourceUrl ? resolveIframeUrl(sourceUrl, props.pwaInfo) : ''
})

function resolveNotificationIframeUrl(sourceUrl, location) {
  if (!sourceUrl || !location || typeof window === 'undefined') return sourceUrl

  try {
    const iframeUrl = new URL(sourceUrl, window.location.origin)
    const routeUrl = new URL(location, iframeUrl.origin)

    if (routeUrl.origin !== iframeUrl.origin || !routeUrl.pathname.startsWith('/')) {
      return sourceUrl
    }

    iframeUrl.pathname = routeUrl.pathname
    routeUrl.searchParams.forEach((value, key) => {
      iframeUrl.searchParams.set(key, value)
    })
    iframeUrl.hash = routeUrl.hash

    return iframeUrl.toString()
  } catch {
    return sourceUrl
  }
}

const iframeSrc = computed(() =>
  resolveNotificationIframeUrl(baseIframeSrc.value, activeNotificationLocation.value),
)

const iframeOrigin = computed(() => {
  if (!iframeSrc.value || typeof window === 'undefined') return ''

  try {
    return new URL(iframeSrc.value, window.location.origin).origin
  } catch {
    return ''
  }
})

function handleIframeLoad() {
  iframeReady.value = true
  scheduleIframeReadyFallback()
  postPendingNotificationNavigation()
  void confirmLoadedIframeNotificationNavigation()
}

function clearIframeReadyFallback() {
  if (!iframeReadyFallbackTimer) return

  window.clearTimeout(iframeReadyFallbackTimer)
  iframeReadyFallbackTimer = 0
}

function revealIframe() {
  clearIframeReadyFallback()
  if (iframeAppReady.value) return

  iframeAppReady.value = true
  void nextTick(() => emit('app-ready'))
}

function scheduleIframeReadyFallback() {
  clearIframeReadyFallback()
  if (iframeAppReady.value) return

  iframeReadyFallbackTimer = window.setTimeout(() => {
    iframeReadyFallbackTimer = 0
    revealIframe()
  }, IFRAME_READY_FALLBACK_MS)
}

function reload() {
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

function postPendingNotificationNavigation() {
  const iframeWindow = iframeRef.value?.contentWindow
  const navigation = pendingNotificationNavigation.value

  if (!iframeReady.value || !iframeWindow || !iframeOrigin.value || !navigation?.location) {
    return
  }

  const targetUrl = new URL(navigation.location, iframeOrigin.value)

  iframeWindow.postMessage(
    {
      type: H5_NOTIFICATION_NAVIGATE,
      navigation: {
        id: navigation.id,
        url: targetUrl.toString(),
      },
    },
    iframeOrigin.value,
  )
}

function applyPendingNotificationNavigation(navigation) {
  pendingNotificationNavigation.value = navigation

  if (navigation?.location) {
    activeNotificationLocation.value = navigation.location
  }

  postPendingNotificationNavigation()
}

async function syncPendingNotificationNavigation() {
  applyPendingNotificationNavigation(await readPendingNotificationNavigation())
}

function hasIframeReachedNavigation(navigation) {
  const iframeWindow = iframeRef.value?.contentWindow

  if (!iframeWindow || !iframeOrigin.value || !navigation?.location) return false

  try {
    const actualUrl = new URL(iframeWindow.location.href)
    const expectedUrl = new URL(navigation.location, iframeOrigin.value)

    if (
      actualUrl.origin !== expectedUrl.origin ||
      actualUrl.pathname !== expectedUrl.pathname ||
      (expectedUrl.hash && actualUrl.hash !== expectedUrl.hash)
    ) {
      return false
    }

    return Array.from(expectedUrl.searchParams).every(
      ([key, value]) => actualUrl.searchParams.get(key) === value,
    )
  } catch {
    // Cross-origin iframe access is blocked; the H5 postMessage acknowledgement handles it.
    return false
  }
}

async function completeNotificationNavigation(navigation) {
  const cleared = await clearPendingNotificationNavigation(navigation.id)

  if (!cleared) {
    void syncPendingNotificationNavigation()
    return
  }

  if (pendingNotificationNavigation.value?.id === navigation.id) {
    pendingNotificationNavigation.value = null
  }
}

async function confirmLoadedIframeNotificationNavigation() {
  const navigation = pendingNotificationNavigation.value

  if (!navigation || !hasIframeReachedNavigation(navigation)) return

  await completeNotificationNavigation(navigation)
}

function handleServiceWorkerMessage(event) {
  if (event.data?.type !== PWA_SHELL_NOTIFICATION_NAVIGATE) return

  const navigation = normalizeNotificationNavigation(event.data?.navigation)

  if (navigation) {
    applyPendingNotificationNavigation(navigation)
  }

  void syncPendingNotificationNavigation()
}

function handleIframeMessage(event) {
  const iframeWindow = iframeRef.value?.contentWindow

  if (event.source !== iframeWindow || event.origin !== iframeOrigin.value) {
    return
  }

  if (isPwaH5AppReadyMessage(event.data)) {
    completePlayerIdentityInstallHandoffForIframe(iframeOrigin.value)
    revealIframe()
    scheduleAndroidNotificationPermission()
    return
  }

  if (
    handlePlayerIdentityIframeMessage({
      event,
      iframeWindow,
      iframeOrigin: iframeOrigin.value,
    })
  ) {
    return
  }

  if (event.data?.type === H5_NOTIFICATION_NAVIGATION_READY) {
    postPendingNotificationNavigation()
    return
  }

  const navigation = pendingNotificationNavigation.value

  if (
    event.data?.type !== H5_NOTIFICATION_NAVIGATION_APPLIED ||
    event.data?.navigationId !== navigation?.id
  ) {
    return
  }

  void completeNotificationNavigation(navigation)
}

watch(iframeSrc, () => {
  clearIframeReadyFallback()
  clearNotificationPermissionTimer()
  iframeReady.value = false
  iframeAppReady.value = false
})

onMounted(() => {
  syncIframeViewportHeight()

  const viewport = window.visualViewport
  viewport?.addEventListener?.('resize', syncIframeViewportHeight)
  viewport?.addEventListener?.('scroll', syncIframeViewportHeight)
  window.addEventListener('resize', syncIframeViewportHeight)
  window.addEventListener('orientationchange', syncIframeViewportHeight)
  window.addEventListener('pageshow', syncIframeViewportHeight)
  window.addEventListener('focusin', syncIframeViewportHeight)
  window.addEventListener('focusout', syncIframeViewportHeight)
  document.addEventListener('visibilitychange', syncIframeViewportHeight)
  navigator.serviceWorker?.addEventListener?.('message', handleServiceWorkerMessage)
  window.addEventListener('message', handleIframeMessage)
  void syncPendingNotificationNavigation()
})

onUnmounted(() => {
  const viewport = window.visualViewport
  viewport?.removeEventListener?.('resize', syncIframeViewportHeight)
  viewport?.removeEventListener?.('scroll', syncIframeViewportHeight)
  window.removeEventListener('resize', syncIframeViewportHeight)
  window.removeEventListener('orientationchange', syncIframeViewportHeight)
  window.removeEventListener('pageshow', syncIframeViewportHeight)
  window.removeEventListener('focusin', syncIframeViewportHeight)
  window.removeEventListener('focusout', syncIframeViewportHeight)
  document.removeEventListener('visibilitychange', syncIframeViewportHeight)
  navigator.serviceWorker?.removeEventListener?.('message', handleServiceWorkerMessage)
  window.removeEventListener('message', handleIframeMessage)
  resetPlayerIdentityIframeBridge()
  clearIframeReadyFallback()
  clearNotificationPermissionTimer()

  if (pendingViewportSync) {
    window.cancelAnimationFrame(pendingViewportSync)
    pendingViewportSync = 0
  }
})
</script>

<template>
  <main class="pwa-iframe-shell" :style="iframeShellStyle">
    <div v-if="loading && !iframeSrc" class="pwa-iframe-shell__state">
      <PwaLoadingSpinner :size="24" />
      <span>{{ t('pwaPage.iframe.loading') }}</span>
    </div>

    <template v-else-if="iframeSrc">
      <iframe
        ref="iframeRef"
        class="pwa-iframe-shell__frame"
        :class="{ 'pwa-iframe-shell__frame--ready': iframeAppReady }"
        :src="iframeSrc"
        title="H5 app"
        allow="
          clipboard-read;
          clipboard-write;
          fullscreen;
          payment;
          autoplay;
          encrypted-media;
          geolocation;
          camera;
          microphone;
        "
        referrerpolicy="origin"
        allowfullscreen
        @load="handleIframeLoad"
      ></iframe>

      <PlayerIdentityLoading v-if="!iframeAppReady" class="pwa-iframe-shell__loading" />
    </template>

    <div v-else class="pwa-iframe-shell__state">
      <p>{{ t('pwaPage.iframe.missingUrl') }}</p>
      <button type="button" @click="reload">
        {{ t('pwaPage.iframe.reload') }}
      </button>
    </div>
  </main>
</template>

<style scoped>
.pwa-iframe-shell {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  height: var(--pwa-iframe-height, 100dvh);
  overflow: hidden;
  overscroll-behavior: none;
  background: #343d44;
}

.pwa-iframe-shell__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #343d44;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease;
  visibility: hidden;
}

.pwa-iframe-shell__frame--ready {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}

.pwa-iframe-shell__loading {
  z-index: 2;
}

.pwa-iframe-shell__state {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  background: #111;
  color: #fff;
  text-align: center;
  font-size: 15px;
  line-height: 22px;
}

.pwa-iframe-shell__state button {
  height: 42px;
  min-width: 112px;
  border: 0;
  border-radius: 6px;
  background: #01875f;
  color: #fff;
  font-size: 15px;
}

@media (prefers-reduced-motion: reduce) {
  .pwa-iframe-shell__frame {
    transition: none;
  }
}
</style>
