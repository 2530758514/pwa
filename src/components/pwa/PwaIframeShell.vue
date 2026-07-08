<script setup>
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { H5_APP_URL } from '@/shared/config/env'
import { t } from '@/content/pwaText'
import PwaLoadingSpinner from '@/components/PwaLoadingSpinner.vue'
import { applyPwaIdentityParams } from '@/shared/pwa/identityParams'

const FALLBACK_IFRAME_HEIGHT = '100vh'

defineOptions({
  name: 'PwaIframeShell',
})

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
let pendingViewportSync = 0

const iframeShellStyle = computed(() => ({
  '--pwa-iframe-height': iframeViewportHeight.value,
}))

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
    if (!key) return

    targetParams.set(key, value)
  })
}

function resolveIframeUrl(sourceUrl, pwaInfo = {}) {
  if (typeof window === 'undefined') return sourceUrl

  try {
    const targetUrl = new URL(sourceUrl, window.location.origin)
    applySearchParams(targetUrl.searchParams, new URLSearchParams(window.location.search))

    const hashQueryIndex = window.location.hash.indexOf('?')
    if (hashQueryIndex !== -1) {
      applySearchParams(
        targetUrl.searchParams,
        new URLSearchParams(window.location.hash.slice(hashQueryIndex + 1)),
      )
    }

    applyPwaIdentityParams(targetUrl.searchParams, pwaInfo)

    return targetUrl.toString()
  } catch {
    return sourceUrl
  }
}

const detailH5Url = computed(() =>
  String(props.pwaInfo?.h5_url || props.pwaInfo?.h5Url || '').trim(),
)

const iframeSrc = computed(() => {
  const fallbackUrl = props.loading ? '' : String(H5_APP_URL || '').trim()
  const sourceUrl = detailH5Url.value || fallbackUrl

  return sourceUrl ? resolveIframeUrl(sourceUrl, props.pwaInfo) : ''
})

function reload() {
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

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

    <iframe
      v-else-if="iframeSrc"
      class="pwa-iframe-shell__frame"
      :src="iframeSrc"
      title="H5 app"
      allow="clipboard-read; clipboard-write; fullscreen; payment; autoplay; encrypted-media; geolocation; camera; microphone"
      allowfullscreen
    ></iframe>

    <div v-else class="pwa-iframe-shell__state">
      <p>{{ t('pwaPage.iframe.missingUrl') }}</p>
      <button type="button" @click="reload">{{ t('pwaPage.iframe.reload') }}</button>
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
  background: #000;
}

.pwa-iframe-shell__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #000;
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
</style>
