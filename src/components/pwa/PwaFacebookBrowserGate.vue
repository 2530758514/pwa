<script setup>
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { t } from '@/content/pwaText'
import PwaOpenBrowserGuide from './PwaOpenBrowserGuide.vue'

defineOptions({
  name: 'PwaFacebookBrowserGate',
})

const FACEBOOK_IN_APP_BROWSER_PATTERN = /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i
const ANDROID_DEVICE_PATTERN = /Android/i
const APPLE_DEVICE_PATTERN = /iPad|iPhone|iPod/i
const AUTO_OPEN_DELAY_MS = 1000
const USER_GESTURE_RETRY_THROTTLE_MS = 800
const USER_GESTURE_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'keydown']
const COPY_ACTION_SELECTOR = '[data-pwa-browser-guide-copy-action]'

function resolveNavigatorValue(key) {
  if (typeof navigator === 'undefined') return ''

  return navigator[key] || ''
}

function resolveIsFacebookInAppBrowser() {
  return FACEBOOK_IN_APP_BROWSER_PATTERN.test(resolveNavigatorValue('userAgent'))
}

function resolveIsAndroidDevice() {
  return ANDROID_DEVICE_PATTERN.test(
    `${resolveNavigatorValue('userAgent')} ${resolveNavigatorValue('platform')}`,
  )
}

function resolveIsAppleDevice() {
  if (typeof navigator === 'undefined') return false

  const userAgent = resolveNavigatorValue('userAgent')
  const platform = resolveNavigatorValue('platform')
  const isAppleMobile = APPLE_DEVICE_PATTERN.test(`${userAgent} ${platform}`)
  const isTouchMac =
    /Macintosh|MacIntel/i.test(`${userAgent} ${platform}`) && navigator.maxTouchPoints > 1

  return isAppleMobile || isTouchMac
}

function resolveCurrentPageUrl() {
  if (typeof window === 'undefined') return ''

  return window.location.href
}

function buildChromeIntentUrl(url) {
  if (typeof window === 'undefined') return url

  try {
    const targetUrl = new URL(url, window.location.origin)
    const scheme = targetUrl.protocol.replace(':', '') || 'https'
    const path = `${targetUrl.host}${targetUrl.pathname}${targetUrl.search}`
    const fallbackUrl = encodeURIComponent(targetUrl.href)

    return `intent://${path}#Intent;scheme=${scheme};package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${fallbackUrl};end`
  } catch {
    return url
  }
}

const isFacebookInAppBrowser = resolveIsFacebookInAppBrowser()
const isAndroidDevice = resolveIsAndroidDevice()
const isAppleDevice = resolveIsAppleDevice()
const showGuide = shallowRef(isFacebookInAppBrowser)
const currentUrl = resolveCurrentPageUrl()
const browserType = isAppleDevice ? 'safari' : 'chrome'
const browserName = isAppleDevice
  ? t('pwaPage.browserGuide.safari')
  : t('pwaPage.browserGuide.chrome')
const openLabel = t('pwaPage.browserGuide.openBrowser', {
  browser: browserName,
})

let autoOpenTimer = null
let autoOpenAttempted = false
let userGestureRetryListening = false
let lastUserGestureAttemptAt = 0

function openCurrentPageInExternalBrowser() {
  if (!isFacebookInAppBrowser || typeof window === 'undefined' || !currentUrl) return

  if (isAndroidDevice) {
    window.location.href = buildChromeIntentUrl(currentUrl)
    return
  }

  window.open(currentUrl, '_blank', 'noopener,noreferrer')
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
    !isFacebookInAppBrowser ||
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
    !isFacebookInAppBrowser ||
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
  if (!isFacebookInAppBrowser) return

  showGuide.value = true
  setupUserGestureRetry()
  scheduleAutoOpen()
}

onMounted(() => {
  if (!isFacebookInAppBrowser) return

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
    @open-browser="retryOpenFromUserGesture"
  />
</template>
