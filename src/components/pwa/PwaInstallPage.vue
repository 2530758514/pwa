<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { t } from '@/content/pwaText'
import {
  PWA_FAMILY_LINKS,
  PWA_FOOTER_LINKS,
  PWA_METRICS,
  PWA_RATING_BARS,
  PWA_SAFETY_ITEMS,
} from '@/content/pwaPageContent'
import { usePwaAddToHomeAction } from '@/composables/pwa/usePwaAddToHomeAction'
import { usePwaInstallPrompt } from '@/composables/pwa/usePwaInstallPrompt'
import { usePwaLaunchAction } from '@/composables/pwa/usePwaLaunchAction'
import { pwaService } from '@/services/pwa'
import { appendBigoAttributionParams } from '@/shared/analytics/bigoAttribution'
import { notifyBigoAppDownload } from '@/shared/analytics/bigoPixel'
import { H5_APP_URL } from '@/shared/config/env'
import { applyPwaIdentityParams } from '@/shared/pwa/identityParams'
import { createQrCodeDataUrl } from '@/shared/utils/qrCode'
import PwaBottomNav from './PwaBottomNav.vue'
import PwaDetailsSections from './PwaDetailsSections.vue'
import PwaHeaderBar from './PwaHeaderBar.vue'
import PwaHeroSection from './PwaHeroSection.vue'
import PwaInstalledOpenPopup from './PwaInstalledOpenPopup.vue'
import PwaOpenBrowserGuide from './PwaOpenBrowserGuide.vue'
import PwaRatingsReviews from './PwaRatingsReviews.vue'
import PwaScreenshotCarousel from './PwaScreenshotCarousel.vue'

defineOptions({
  name: 'PwaInstallPage',
})

const props = defineProps({
  pwaInfo: {
    type: Object,
    default: () => ({}),
  },
  loadingInfo: {
    type: Boolean,
    default: false,
  },
  loadPwaInfo: {
    type: Function,
    default: null,
  },
})

const INSTALL_PROGRESS_DURATION_MS = 12000
const INSTALL_PROGRESS_STEP_PERCENT = 5
const INSTALL_PROGRESS_MAX_PERCENT = 100
const INSTALL_PROGRESS_STEP_MS =
  INSTALL_PROGRESS_DURATION_MS / (INSTALL_PROGRESS_MAX_PERCENT / INSTALL_PROGRESS_STEP_PERCENT)
const INSTALLED_OPEN_POPUP_DELAY_MS = 15000
const ANDROID_INSTALL_PROMPT_WAIT_MS = 32000
const DEFAULT_INSTALL_PROMPT_WAIT_MS = 6000
const OPEN_APP_RETRY_WINDOW_MS = 5000
const OPEN_APP_RETRY_INTERVAL_MS = 1000
const OPEN_APP_RETRY_MAX_ATTEMPTS = Math.max(
  Math.floor(OPEN_APP_RETRY_WINDOW_MS / OPEN_APP_RETRY_INTERVAL_MS) - 1,
  0,
)
const INSTALLED_OPEN_POPUP_SESSION_KEY = 'pwa:installed-open-popup-pending'
const IN_APP_OPEN_VUE_ATTEMPT_STORAGE_PREFIX = 'pwa:in-app-vue-open-attempt:'
const OPEN_BROWSER_AUTO_OPEN_DELAY_MS = 1000
const OPEN_BROWSER_USER_GESTURE_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'keydown']
const OPEN_BROWSER_COPY_ACTION_SELECTOR = '[data-pwa-browser-guide-copy-action]'
const IOS_H5_REDIRECT_PARAM = 'pwa_ios_h5_redirect'
const IOS_H5_REDIRECT_VALUE = '1'

const {
  canPromptInstall,
  hasInstallPromptEvent,
  isInstalled,
  isStandalone,
  waitForInstallPrompt,
} = usePwaInstallPrompt()
const {
  nativeInstalling,
  prepareInstallManifest,
  preparingInstall,
  requestAddToHome,
} = usePwaAddToHomeAction({
  getPwaInfo: () => props.pwaInfo,
})
const { tryOpenInstalledPwa } = usePwaLaunchAction()

const installing = shallowRef(false)
const installVisualActive = shallowRef(false)
const installProgressPercent = shallowRef(0)
const installPromptShown = shallowRef(false)
const installPromptProbeFinished = shallowRef(false)
const postInstallOpenRequested = shallowRef(false)
const showInstalledOpenPopup = shallowRef(false)
const showOpenBrowserGuide = shallowRef(false)
const qrCodeSrc = shallowRef('')
const showQrCode = shallowRef(false)
const toastText = shallowRef('')
let desktopPointerQuery = null
let mobileViewportQuery = null
let postInstallActionTimer = null
let installProgressTimer = null
let postInstallActionStarted = false
let installedOpenPopupPending = false
let installedOpenPopupDueAt = 0
let androidPwaInstallCompletionRequest = null
let openBrowserGuideAutoOpenAttempted = false
let openBrowserGuideAutoOpenTimer = null
let openBrowserGuideUserGestureRetryListening = false
let toastTimer = null
let openAppRetryTimer = null
let openAppRetryAttemptCount = 0

const appInfo = computed(() => {
  const remote = props.pwaInfo || {}
  const screenshots = Array.isArray(remote.pwa_carousel) ? remote.pwa_carousel : []
  const remoteName = String(
    remote.pwaInstallName || remote.installName || remote.pwa_name || remote.pwaName || remote.name || '',
  ).trim()
  const introduction = String(remote.introduction || '').trim()

  return {
    name: remoteName,
    publisher: remote.publisher || '',
    logo: remote.logo || '',
    rating: remote.rating || '',
    downloads: remote.downloads || '',
    downloadRewardAmount: remote.downloadRewardAmount ?? '',
    comments: Number.isFinite(remote.comments) ? remote.comments : '',
    introduction,
    labels: Array.isArray(remote.labels) ? remote.labels : [],
    updatedDate: remote.updatedDate || '',
    reviews: Array.isArray(remote.reviews) ? remote.reviews : [],
    screenshots,
  }
})

const h5Link = computed(
  () => String(props.pwaInfo?.h5_url || props.pwaInfo?.h5Url || H5_APP_URL || '').trim(),
)
const pwaBottomMenuDefault = computed(() => props.pwaInfo?.bottomMenuDefault || 'games')
const showGoogleIcon = computed(() => Number(props.pwaInfo?.google_icon_enabled ?? 1) !== 0)
const showOfficialCertification = computed(
  () => Number(props.pwaInfo?.official_certification_enabled ?? 1) !== 0,
)
const qrCodeEnabled = computed(() => Number(props.pwaInfo?.qr_code_enabled ?? 1) !== 0)
const effectiveShowQrCode = computed(() => showQrCode.value && qrCodeEnabled.value)
const isApplePwaRedirectDevice = computed(() => resolveIsAppleDevice())
const isAndroidPwaInstallDevice = computed(() => resolveIsAndroidDevice())
const isInAppBrowser = computed(() => resolveIsInAppBrowser())
const isLockedInAppBrowser = computed(() => resolveIsLockedInAppBrowser())
const isMobileExternalBrowserGuideDevice = computed(
  () => isAndroidPwaInstallDevice.value || isApplePwaRedirectDevice.value,
)
const shouldUseOpenBrowserGuide = computed(
  () =>
    isMobileExternalBrowserGuideDevice.value &&
    isInAppBrowser.value &&
    !isInstalled.value &&
    !isStandalone.value,
)
const shouldLockOpenBrowserGuide = computed(
  () => shouldUseOpenBrowserGuide.value && isLockedInAppBrowser.value,
)
const openBrowserGuideUrl = computed(() => resolveCurrentPageUrl())
const openBrowserGuideType = computed(() => (isApplePwaRedirectDevice.value ? 'safari' : 'chrome'))
const openBrowserGuideName = computed(() =>
  isApplePwaRedirectDevice.value ? t('pwaPage.browserGuide.safari') : t('pwaPage.browserGuide.chrome'),
)
const openBrowserGuideLabel = computed(() =>
  t('pwaPage.browserGuide.openBrowser', {
    browser: openBrowserGuideName.value,
  }),
)
const isPlayNowVisible = computed(
  () =>
    !installVisualActive.value &&
    (postInstallOpenRequested.value ||
      isInstalled.value ||
      isStandalone.value ||
      isApplePwaRedirectDevice.value),
)
const installLabel = computed(() => {
  if (installVisualActive.value) return t('pwaPage.install.installingProgress')
  if (isPlayNowVisible.value) return t('pwaPage.install.playNow')

  return t('pwaPage.install.mainCta')
})
const installSubtitle = computed(() => {
  if (installVisualActive.value) return ''
  if (installing.value) return t('pwaPage.install.installing')
  if (postInstallOpenRequested.value) return t('pwaPage.install.installed')
  if (isInstalled.value || isStandalone.value) return t('pwaPage.install.installed')
  return t('pwaPage.install.safe')
})
const installProgressText = computed(() =>
  installVisualActive.value
    ? t('pwaPage.install.installProgressMeta', {
        percent: installProgressPercent.value,
      })
    : '',
)
const installButtonLoading = computed(
  () => installing.value || nativeInstalling.value || preparingInstall.value || installVisualActive.value,
)
const installButtonDisabled = computed(
  () =>
    installing.value ||
    installVisualActive.value ||
    (installPromptShown.value && !isInstalled.value && !postInstallOpenRequested.value),
)
const hasLoadedPwaInfo = computed(() => Object.keys(props.pwaInfo || {}).length > 0)

function appendSearchParams(targetParams, sourceParams) {
  sourceParams.forEach((value, key) => {
    if (!key || targetParams.has(key)) return

    targetParams.append(key, value)
  })
}

async function prepareInstallPrompt(options = {}) {
  const forceRefresh = options.forceRefresh === true

  if (typeof props.loadPwaInfo === 'function' && (forceRefresh || !hasLoadedPwaInfo.value)) {
    await props.loadPwaInfo({ force: forceRefresh })
  }

  await prepareInstallManifest({ forceRefresh })

  if (!isApplePwaRedirectDevice.value) {
    await waitForInstallPrompt({
      ...options,
      rejectDefaultManifest: true,
    })
  }
}

function resolveIsMobileDevice() {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent || ''
  const platform = navigator.platform || ''

  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent) ||
    /Android|iPhone|iPad|iPod/i.test(platform)
  )
}

function resolveIsAppleDevice() {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent) || /iPad|iPhone|iPod/i.test(platform)
  const isTouchMac =
    /Macintosh|MacIntel/i.test(userAgent + platform) && navigator.maxTouchPoints > 1

  return isIOS || isTouchMac
}

function resolveIsAndroidDevice() {
  if (typeof navigator === 'undefined') return false

  return /Android/i.test(`${navigator.userAgent || ''} ${navigator.platform || ''}`)
}

function resolveIsInAppBrowser() {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent || ''

  return /Lark|Feishu|LarkLocale|Instagram|Line|MicroMessenger|DingTalk|Twitter|WhatsApp/i.test(
    userAgent,
  )
}

function resolveIsLockedInAppBrowser() {
  if (typeof navigator === 'undefined') return false

  return /Lark|Feishu|LarkLocale/i.test(navigator.userAgent || '')
}

function syncQrCodeVisibility() {
  if (typeof window === 'undefined') {
    showQrCode.value = false
    return
  }

  const hasDesktopPointer =
    desktopPointerQuery?.matches ??
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ??
    false
  const isNarrowViewport = mobileViewportQuery?.matches ?? window.innerWidth <= 430
  showQrCode.value = hasDesktopPointer && !isNarrowViewport && !resolveIsMobileDevice()
}

async function setupQrCode() {
  if (typeof window === 'undefined') return

  desktopPointerQuery = window.matchMedia?.('(hover: hover) and (pointer: fine)') || null
  mobileViewportQuery = window.matchMedia?.('(max-width: 430px)') || null
  syncQrCodeVisibility()

  try {
    qrCodeSrc.value = await createQrCodeDataUrl(window.location.href)
  } catch {
    qrCodeSrc.value = ''
  }

  desktopPointerQuery?.addEventListener?.('change', syncQrCodeVisibility)
  mobileViewportQuery?.addEventListener?.('change', syncQrCodeVisibility)
}

function teardownQrCode() {
  desktopPointerQuery?.removeEventListener?.('change', syncQrCodeVisibility)
  mobileViewportQuery?.removeEventListener?.('change', syncQrCodeVisibility)
  desktopPointerQuery = null
  mobileViewportQuery = null
}

function resolvePwaRedirectUrl(url) {
  if (typeof window === 'undefined') return url

  try {
    const targetUrl = new URL(url, window.location.origin)
    appendSearchParams(targetUrl.searchParams, new URLSearchParams(window.location.search))

    const hashQueryIndex = window.location.hash.indexOf('?')
    if (hashQueryIndex !== -1) {
      appendSearchParams(
        targetUrl.searchParams,
        new URLSearchParams(window.location.hash.slice(hashQueryIndex + 1)),
      )
    }

    applyPwaIdentityParams(targetUrl.searchParams, props.pwaInfo)
    appendBigoAttributionParams(targetUrl.searchParams)

    if (isApplePwaRedirectDevice.value) {
      targetUrl.searchParams.set(IOS_H5_REDIRECT_PARAM, IOS_H5_REDIRECT_VALUE)
    }

    return targetUrl.toString()
  } catch {
    return url
  }
}

function resolveH5RedirectUrl() {
  return h5Link.value ? resolvePwaRedirectUrl(h5Link.value) : ''
}

function redirectToH5Page() {
  if (typeof window === 'undefined') return false

  const targetUrl = resolveH5RedirectUrl()
  if (!targetUrl) return false

  clearOpenAppAttempt()
  window.location.href = targetUrl
  return true
}

function clearOpenAppAttempt() {
  clearOpenAppRetryTimer()
}

function clearOpenAppRetryTimer() {
  if (!openAppRetryTimer || typeof window === 'undefined') return

  window.clearInterval(openAppRetryTimer)
  openAppRetryTimer = null
  openAppRetryAttemptCount = 0
}

function scheduleOpenAppRetries(launchMode) {
  if (
    typeof window === 'undefined' ||
    launchMode !== 'android_intent' ||
    !isAndroidPwaInstallDevice.value
  ) {
    return
  }

  clearOpenAppRetryTimer()
  openAppRetryTimer = window.setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'hidden') {
      clearOpenAppRetryTimer()
      return
    }

    openAppRetryAttemptCount += 1
    tryOpenInstalledPwa({
      fallback: false,
      intentBrowserFallback: false,
      launchMode,
      target: '_self',
    })

    if (openAppRetryAttemptCount >= OPEN_APP_RETRY_MAX_ATTEMPTS) {
      clearOpenAppRetryTimer()
    }
  }, OPEN_APP_RETRY_INTERVAL_MS)
}

function startInstallVisualState() {
  postInstallOpenRequested.value = false
  postInstallActionStarted = false
  clearPendingInstalledOpenPopup()
  installVisualActive.value = true
  startInstallProgressTimer()
}

function resetInstallLoadingState() {
  installing.value = false
  installVisualActive.value = false
  clearInstallProgressTimer()
  installProgressPercent.value = 0
}

function clearPostInstallActionTimer() {
  if (!postInstallActionTimer || typeof window === 'undefined') return

  window.clearTimeout(postInstallActionTimer)
  postInstallActionTimer = null
}

function clearInstallProgressTimer() {
  if (!installProgressTimer || typeof window === 'undefined') return

  window.clearInterval(installProgressTimer)
  installProgressTimer = null
}

function readPendingInstalledOpenPopup() {
  if (typeof window === 'undefined') return null

  try {
    const state = JSON.parse(
      window.sessionStorage.getItem(INSTALLED_OPEN_POPUP_SESSION_KEY) || 'null',
    )
    const dueAt = Number(state?.dueAt)

    if (!Number.isFinite(dueAt) || dueAt <= 0) {
      window.sessionStorage.removeItem(INSTALLED_OPEN_POPUP_SESSION_KEY)
      return null
    }

    return { dueAt }
  } catch {
    return null
  }
}

function persistPendingInstalledOpenPopup() {
  if (
    typeof window === 'undefined' ||
    !installedOpenPopupPending ||
    !installedOpenPopupDueAt
  ) {
    return
  }

  try {
    window.sessionStorage.setItem(
      INSTALLED_OPEN_POPUP_SESSION_KEY,
      JSON.stringify({ dueAt: installedOpenPopupDueAt }),
    )
  } catch {
    // Keep the in-memory fallback when session storage is unavailable.
  }
}

function clearPendingInstalledOpenPopup() {
  installedOpenPopupPending = false
  installedOpenPopupDueAt = 0

  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(INSTALLED_OPEN_POPUP_SESSION_KEY)
  } catch {
    // The in-memory state is already cleared.
  }
}

function reportAndroidPwaInstallCompletionOnce() {
  if (!isAndroidPwaInstallDevice.value) return Promise.resolve()
  if (androidPwaInstallCompletionRequest) return androidPwaInstallCompletionRequest

  androidPwaInstallCompletionRequest = pwaService
    .recordAndroidPwaInstallCompletion()
    .catch(() => null)

  return androidPwaInstallCompletionRequest
}

function startInstallProgressTimer() {
  if (typeof window === 'undefined') return

  clearInstallProgressTimer()
  installProgressPercent.value = INSTALL_PROGRESS_STEP_PERCENT
  installProgressTimer = window.setInterval(() => {
    const nextPercent = Math.min(
      installProgressPercent.value + INSTALL_PROGRESS_STEP_PERCENT,
      INSTALL_PROGRESS_MAX_PERCENT,
    )
    installProgressPercent.value = nextPercent

    if (nextPercent >= INSTALL_PROGRESS_MAX_PERCENT) {
      clearInstallProgressTimer()
      void reportAndroidPwaInstallCompletionOnce()
    }
  }, INSTALL_PROGRESS_STEP_MS)
}

function shouldShowInstalledOpenPopup() {
  if (typeof document === 'undefined') return false

  return document.visibilityState !== 'hidden' && !isStandalone.value
}

function openInstalledOpenPopup() {
  if (!shouldShowInstalledOpenPopup()) return false

  showInstalledOpenPopup.value = true
  postInstallActionStarted = true
  return true
}

function resolvePostInstallActionDelay(delay) {
  if (Number.isFinite(delay)) return delay

  return INSTALLED_OPEN_POPUP_DELAY_MS
}

function runPostInstallAction() {
  clearPostInstallActionTimer()

  if (postInstallActionStarted) return

  if (isStandalone.value) {
    clearPendingInstalledOpenPopup()
    return
  }

  clearInstallProgressTimer()
  installProgressPercent.value = INSTALL_PROGRESS_MAX_PERCENT
  installedOpenPopupPending = true
  persistPendingInstalledOpenPopup()

  openInstalledOpenPopup()
}

function schedulePostInstallAction(delay, options = {}) {
  if (typeof window === 'undefined' || isStandalone.value) return

  const requestedDueAt = Number(options.dueAt)
  const dueAt =
    Number.isFinite(requestedDueAt) && requestedDueAt > 0
      ? requestedDueAt
      : Date.now() + resolvePostInstallActionDelay(delay)

  clearPostInstallActionTimer()
  installedOpenPopupPending = true
  installedOpenPopupDueAt = dueAt
  persistPendingInstalledOpenPopup()
  postInstallActionTimer = window.setTimeout(() => {
    postInstallActionTimer = null
    runPostInstallAction()
  }, Math.max(0, dueAt - Date.now()))
}

function restorePendingInstalledOpenPopup() {
  if (isStandalone.value) {
    clearPendingInstalledOpenPopup()
    return
  }

  const state = readPendingInstalledOpenPopup()
  if (!state) return

  installPromptShown.value = true
  installVisualActive.value = true
  installProgressPercent.value = INSTALL_PROGRESS_MAX_PERCENT
  schedulePostInstallAction(undefined, { dueAt: state.dueAt })
}

function handlePostInstallPageVisible() {
  if (typeof document === 'undefined' || document.visibilityState === 'hidden') return
  if (!installedOpenPopupPending || postInstallActionStarted) return

  if (Date.now() >= installedOpenPopupDueAt) {
    runPostInstallAction()
  }
}

function handleInstalledOpen() {
  postInstallOpenRequested.value = true
  resetInstallLoadingState()
  tryOpenInstalledPwaFromLanding()
}

function handleInstalledPopupClose() {
  clearPendingInstalledOpenPopup()
  resetInstallLoadingState()
}

function resolveCurrentPageUrl() {
  if (typeof window === 'undefined') return ''

  return window.location.href
}

function resolveInAppVueOpenAttemptKey() {
  if (typeof window === 'undefined') return ''

  try {
    const cleanUrl = new URL(window.location.href)

    return `${IN_APP_OPEN_VUE_ATTEMPT_STORAGE_PREFIX}${cleanUrl.origin}${cleanUrl.pathname}${cleanUrl.search}`
  } catch {
    return ''
  }
}

function hasInAppVueOpenAttempt() {
  const attemptKey = resolveInAppVueOpenAttemptKey()
  if (!attemptKey || typeof sessionStorage === 'undefined') return false

  try {
    return sessionStorage.getItem(attemptKey) === '1'
  } catch {
    return false
  }
}

function markInAppVueOpenAttempt() {
  const attemptKey = resolveInAppVueOpenAttemptKey()
  if (!attemptKey || typeof sessionStorage === 'undefined') return

  try {
    sessionStorage.setItem(attemptKey, '1')
  } catch {
    /* empty */
  }
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

function autoOpenCurrentPageInExternalBrowser() {
  if (typeof window === 'undefined') return

  const currentUrl = openBrowserGuideUrl.value || window.location.href

  if (isAndroidPwaInstallDevice.value) {
    window.location.href = buildChromeIntentUrl(currentUrl)
    return
  }

  openCurrentPageInExternalBrowser()
}

function handleOpenBrowserUserGestureRetry(event) {
  if (!shouldLockOpenBrowserGuide.value || !showOpenBrowserGuide.value) return
  if (event?.target?.closest?.(OPEN_BROWSER_COPY_ACTION_SELECTOR)) return

  autoOpenCurrentPageInExternalBrowser()
}

function setupOpenBrowserUserGestureRetry() {
  if (typeof window === 'undefined' || openBrowserGuideUserGestureRetryListening) return

  OPEN_BROWSER_USER_GESTURE_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, handleOpenBrowserUserGestureRetry, true)
  })
  openBrowserGuideUserGestureRetryListening = true
}

function teardownOpenBrowserUserGestureRetry() {
  if (typeof window === 'undefined' || !openBrowserGuideUserGestureRetryListening) return

  OPEN_BROWSER_USER_GESTURE_EVENTS.forEach((eventName) => {
    window.removeEventListener(eventName, handleOpenBrowserUserGestureRetry, true)
  })
  openBrowserGuideUserGestureRetryListening = false
}

function clearOpenBrowserAutoOpenTimer() {
  if (!openBrowserGuideAutoOpenTimer || typeof window === 'undefined') return

  window.clearTimeout(openBrowserGuideAutoOpenTimer)
  openBrowserGuideAutoOpenTimer = null
}

function maybeAutoOpenExternalBrowserFromGuide() {
  if (!shouldLockOpenBrowserGuide.value || openBrowserGuideAutoOpenAttempted) return
  if (typeof window === 'undefined') return
  if (hasInAppVueOpenAttempt()) return

  openBrowserGuideAutoOpenAttempted = true

  void nextTick(() => {
    clearOpenBrowserAutoOpenTimer()
    openBrowserGuideAutoOpenTimer = window.setTimeout(() => {
      openBrowserGuideAutoOpenTimer = null
      if (!shouldLockOpenBrowserGuide.value || !showOpenBrowserGuide.value) return

      markInAppVueOpenAttempt()
      autoOpenCurrentPageInExternalBrowser()
    }, OPEN_BROWSER_AUTO_OPEN_DELAY_MS)
  })
}

function openExternalBrowserGuide(options = {}) {
  showOpenBrowserGuide.value = true

  if (shouldLockOpenBrowserGuide.value) {
    setupOpenBrowserUserGestureRetry()
  }

  if (options.autoOpen === true) {
    maybeAutoOpenExternalBrowserFromGuide()
  }
}

function openCurrentPageInExternalBrowser() {
  if (typeof window === 'undefined') return

  const currentUrl = openBrowserGuideUrl.value || window.location.href

  if (isAndroidPwaInstallDevice.value) {
    window.location.href = buildChromeIntentUrl(currentUrl)
    return
  }

  const openedWindow = window.open(currentUrl, '_blank', 'noopener,noreferrer')
  if (!openedWindow) {
    window.location.href = currentUrl
  }
}

function tryOpenInstalledPwaFromLanding() {
  clearOpenAppAttempt()

  const launchMode = isAndroidPwaInstallDevice.value ? 'android_intent' : 'protocol'
  const result = tryOpenInstalledPwa({
    fallback: false,
    intentBrowserFallback: false,
    launchMode,
    target: '_self',
  })

  scheduleOpenAppRetries(launchMode)

  return result.outcome === 'attempted'
}

function shouldAttemptInstalledPwaOpen() {
  if (isInstalled.value || postInstallOpenRequested.value) return true

  return (
    isAndroidPwaInstallDevice.value &&
    !isInAppBrowser.value &&
    installPromptProbeFinished.value &&
    !canPromptInstall.value &&
    !hasInstallPromptEvent.value
  )
}

function isInstallActionClick(event) {
  return Boolean(event?.target?.closest?.('[data-pwa-install-action]'))
}

function handlePageClick(event) {
  if (isInstallActionClick(event)) return
  if (installPromptShown.value || installing.value || installVisualActive.value) return
  if (showOpenBrowserGuide.value || isInstalled.value || isStandalone.value) return

  handlePopupDownload()
}

function showLocalToast(message) {
  toastText.value = message

  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastText.value = ''
    toastTimer = null
  }, 1800)
}

function resolveAndroidInstallUnavailableText() {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return t('pwaPage.install.secureRequired')
  }

  return t('pwaPage.install.promptUnavailable')
}

async function runNativeInstallPrompt() {
  if (installing.value || installVisualActive.value) return
  if (isStandalone.value) return

  if (shouldAttemptInstalledPwaOpen()) {
    tryOpenInstalledPwaFromLanding()
    return
  }

  if (installPromptShown.value) return

  installing.value = true

  try {
    const result = await requestAddToHome({
      forceRefresh: true,
      waitMs: isAndroidPwaInstallDevice.value
        ? ANDROID_INSTALL_PROMPT_WAIT_MS
        : DEFAULT_INSTALL_PROMPT_WAIT_MS,
    })

    if (result.outcome === 'accepted') {
      installPromptShown.value = true
      startInstallVisualState()
      schedulePostInstallAction()
      showLocalToast(t('pwaPage.install.accepted'))
      return
    }

    if (result.outcome === 'ready') {
      showLocalToast(t('pwaPage.install.ready'))
      return
    }

    if (result.outcome === 'installed') {
      tryOpenInstalledPwaFromLanding()
      return
    }

    if (result.outcome === 'dismissed') return
  } finally {
    installing.value = false
  }

  if (isAndroidPwaInstallDevice.value) {
    showLocalToast(resolveAndroidInstallUnavailableText())
    return
  }

  redirectToH5Page()
}

function handlePopupDownload(controller) {
  if (isStandalone.value) return

  if (installing.value || installVisualActive.value) return

  if (postInstallOpenRequested.value) {
    tryOpenInstalledPwaFromLanding()
    controller?.finish?.({ repeat: false })
    return
  }

  if (shouldAttemptInstalledPwaOpen()) {
    tryOpenInstalledPwaFromLanding()
    controller?.finish?.({ repeat: false })
    return
  }

  if (shouldUseOpenBrowserGuide.value) {
    openExternalBrowserGuide({ autoOpen: shouldLockOpenBrowserGuide.value })
    controller?.finish?.({ repeat: false })
    return
  }

  notifyBigoAppDownload()

  if (isApplePwaRedirectDevice.value) {
    redirectToH5Page()
    controller?.finish?.({ repeat: false })
    return
  }

  void runNativeInstallPrompt().finally(() => {
    controller?.finish?.({ repeat: false })
  })
}

onMounted(() => {
  document.addEventListener('visibilitychange', handlePostInstallPageVisible)
  window.addEventListener('pageshow', handlePostInstallPageVisible)
  restorePendingInstalledOpenPopup()

  if (isAndroidPwaInstallDevice.value) {
    void pwaService.recordAndroidPwaDownloadPageVisit().catch(() => {})
  }

  void prepareInstallPrompt().finally(() => {
    installPromptProbeFinished.value = true
  })
  void setupQrCode()

  if (shouldUseOpenBrowserGuide.value) {
    openExternalBrowserGuide({ autoOpen: shouldLockOpenBrowserGuide.value })
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handlePostInstallPageVisible)
  window.removeEventListener('pageshow', handlePostInstallPageVisible)
  clearPostInstallActionTimer()
  clearInstallProgressTimer()
  clearOpenAppAttempt()
  clearOpenBrowserAutoOpenTimer()
  teardownOpenBrowserUserGestureRetry()
  teardownQrCode()
  if (toastTimer) window.clearTimeout(toastTimer)
})

watch(showOpenBrowserGuide, (visible) => {
  if (visible) {
    if (shouldLockOpenBrowserGuide.value) {
      setupOpenBrowserUserGestureRetry()
    }

    return
  }

  teardownOpenBrowserUserGestureRetry()
  clearOpenBrowserAutoOpenTimer()

  if (!shouldLockOpenBrowserGuide.value) return

  openExternalBrowserGuide({ autoOpen: true })
})
</script>

<template>
  <section class="pwa-page-root min-h-screen bg-white text-[#202124]" @click="handlePageClick">
    <div class="min-h-screen w-full bg-white pb-[70px]">
      <PwaHeaderBar
        :show-google-icon="showGoogleIcon"
        :show-official-certification="showOfficialCertification"
      />

      <main :aria-busy="loadingInfo">
        <PwaHeroSection
          :app="appInfo"
          :metrics="PWA_METRICS"
          :install-label="installLabel"
          :install-subtitle="installSubtitle"
          :install-loading="installButtonLoading"
          :install-disabled="installButtonDisabled"
          :install-visual-active="installVisualActive"
          :install-progress-text="installProgressText"
          :show-qr-code="effectiveShowQrCode"
          :qr-code-src="qrCodeSrc"
          @install="handlePopupDownload"
        />
        <PwaScreenshotCarousel :screenshots="appInfo.screenshots" />
        <PwaDetailsSections
          :about="appInfo.introduction"
          :safety-items="PWA_SAFETY_ITEMS"
          :tags="appInfo.labels"
          :updated-date="appInfo.updatedDate"
        />
        <PwaRatingsReviews
          :rating-bars="PWA_RATING_BARS"
          :reviews="appInfo.reviews"
        />
      </main>

      <PwaBottomNav
        :active-key="pwaBottomMenuDefault"
        :family-links="PWA_FAMILY_LINKS"
        :links="PWA_FOOTER_LINKS"
      />
      <PwaOpenBrowserGuide
        v-model="showOpenBrowserGuide"
        :browser-name="openBrowserGuideName"
        :browser-type="openBrowserGuideType"
        :closable="!shouldLockOpenBrowserGuide"
        :current-url="openBrowserGuideUrl"
        :open-label="openBrowserGuideLabel"
        @open-browser="openCurrentPageInExternalBrowser"
      />
      <PwaInstalledOpenPopup
        v-model="showInstalledOpenPopup"
        :app="appInfo"
        @open="handleInstalledOpen"
        @close="handleInstalledPopupClose"
      />
      <div v-if="toastText" class="pwa-page-root__toast">{{ toastText }}</div>
    </div>
  </section>
</template>

<style scoped>
.pwa-page-root {
  width: 100%;
  max-width: none;
}

.pwa-page-root :deep(.app-fixed-viewport) {
  max-width: none !important;
}

.pwa-page-root__toast {
  position: fixed;
  bottom: 84px;
  left: 50%;
  z-index: 1000060;
  max-width: 320px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.78);
  padding: 10px 16px;
  color: #fff;
  font-size: 14px;
}
</style>
