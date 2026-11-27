<script setup>
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { t } from '@/content/pwaText'
import { isFacebookInAppBrowserRuntime, isAndroidFacebookInAppBrowserRuntime } from '@/shared/pwa/installIdentityHandoff'
import { buildSafariOpenUrl } from '@/shared/pwa/safariOpenUrl'
import PwaOpenBrowserGuide from './PwaOpenBrowserGuide.vue'

defineOptions({
  name: 'PwaFacebookBrowserGate',
})

const props = defineProps({ includeIos: { type: Boolean, default: false } })
const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent + navigator.platform) ||
  (/Macintosh|MacIntel/i.test(navigator.userAgent + navigator.platform) && navigator.maxTouchPoints > 1)

const AUTO_OPEN_DELAY_MS = 1000
const USER_GESTURE_RETRY_THROTTLE_MS = 800
const USER_GESTURE_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'keydown']
const COPY_ACTION_SELECTOR = '[data-pwa-browser-guide-copy-action]'

function resolveCurrentPageUrl() {
  if (typeof window === 'undefined') return ''

  return window.location.href
}

function buildChromeIntentUrl(url) {
  if (typeof window === 'undefined') return url

  try {
    const targetUrl = new URL(url, window.location.origin)
    const scheme = targetUrl.protocol.replace(':', '') || 'https'
    const path = `${targetUrl.host}${targetUrl.pathname}${targetUrl.search}${props.includeIos ? targetUrl.hash : ''}`
    const fallbackUrl = encodeURIComponent(targetUrl.href)

    return `intent://${path}#Intent;scheme=${scheme};package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${fallbackUrl};end`
  } catch {
    return url
  }
}

const shouldUseExternalBrowserGate = isAndroidFacebookInAppBrowserRuntime() ||
  (props.includeIos && isApple && isFacebookInAppBrowserRuntime())
const showGuide = shallowRef(shouldUseExternalBrowserGate)
const currentUrl = resolveCurrentPageUrl()
const browserType = props.includeIos && isApple ? 'safari' : 'chrome'
const safariOpenUrl = browserType === 'safari' ? buildSafariOpenUrl(currentUrl) : ''
const browserName = t(`pwaPage.browserGuide.${browserType}`)
const openLabel = t('pwaPage.browserGuide.openBrowser', {
  browser: browserName,
})

let autoOpenTimer = null
let autoOpenAttempted = false
let userGestureRetryListening = false
let lastUserGestureAttemptAt = 0

function openCurrentPageInExternalBrowser() {
  if (!shouldUseExternalBrowserGate || typeof window === 'undefined' || !currentUrl) return

  if (browserType === 'safari') {
    // Keep the private-scheme navigation synchronous with the explicit button click.
    // Facebook/iOS owns any external-app confirmation; dispatch is not proof of success.
    if (safariOpenUrl) window.location.href = safariOpenUrl
    return
  }
  window.location.href = buildChromeIntentUrl(currentUrl)
}

function retryOpenFromUserGesture(event) {
  if (!showGuide.value || event?.target?.closest?.(COPY_ACTION_SELECTOR)) return

  const attemptedAt = Date.now()
  if (attemptedAt - lastUserGestureAttemptAt < USER_GESTURE_RETRY_THROTTLE_MS) return

  lastUserGestureAttemptAt = attemptedAt
  openCurrentPageInExternalBrowser()
}

function setupUserGestureRetry() {
  if (
    typeof window === 'undefined' ||
    !shouldUseExternalBrowserGate ||
    browserType === 'safari' ||
    userGestureRetryListening
  ) {
    return
  }

  USER_GESTURE_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, retryOpenFromUserGesture, true)
  })
  userGestureRetryListening = true
}

function teardownUserGestureRetry() {
  if (typeof window === 'undefined' || !userGestureRetryListening) return

  USER_GESTURE_EVENTS.forEach((eventName) => {
    window.removeEventListener(eventName, retryOpenFromUserGesture, true)
  })
  userGestureRetryListening = false
}

function clearAutoOpenTimer() {
  if (!autoOpenTimer || typeof window === 'undefined') return

  window.clearTimeout(autoOpenTimer)
  autoOpenTimer = null
}

function scheduleAutoOpen() {
  if (
    typeof window === 'undefined' ||
    !shouldUseExternalBrowserGate ||
    browserType === 'safari' ||
    autoOpenAttempted
  ) {
    return
  }

  autoOpenAttempted = true
  clearAutoOpenTimer()
  autoOpenTimer = window.setTimeout(() => {
    autoOpenTimer = null
    if (!showGuide.value) return

    openCurrentPageInExternalBrowser()
  }, AUTO_OPEN_DELAY_MS)
}

function handlePageShow() {
  if (!shouldUseExternalBrowserGate) return

  showGuide.value = true
  setupUserGestureRetry()
  scheduleAutoOpen()
}

onMounted(() => {
  if (!shouldUseExternalBrowserGate) return

  setupUserGestureRetry()
  scheduleAutoOpen()
  window.addEventListener('pageshow', handlePageShow)
})

onBeforeUnmount(() => {
  clearAutoOpenTimer()
  teardownUserGestureRetry()
  window.removeEventListener('pageshow', handlePageShow)
})
</script>

<template>
  <PwaOpenBrowserGuide
    v-model="showGuide"
    :browser-name="browserName"
    :browser-type="browserType"
    :closable="false"
    :current-url="currentUrl"
    :open-label="openLabel"
    :manual-only="browserType === 'safari' && !safariOpenUrl"
    @open-browser="retryOpenFromUserGesture"
  />
</template>
