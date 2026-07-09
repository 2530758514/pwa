<script setup>
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { t } from '@/content/pwaText'
import {
  PWA_FAMILY_LINKS,
  PWA_FOOTER_LINKS,
  PWA_METRICS,
  PWA_RATING_BARS,
  PWA_SAFETY_ITEMS,
  SOURCE_DOWNLOAD_URL,
} from '@/content/pwaPageContent'
import { usePwaAddToHomeAction } from '@/composables/pwa/usePwaAddToHomeAction'
import { usePwaInstallPrompt } from '@/composables/pwa/usePwaInstallPrompt'
import { usePwaLaunchAction } from '@/composables/pwa/usePwaLaunchAction'
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

const FALLBACK_PWA_LINK = SOURCE_DOWNLOAD_URL
const INSTALL_PROGRESS_DURATION_MS = 12000
const INSTALL_PROGRESS_STEP_PERCENT = 5
const INSTALL_PROGRESS_MAX_PERCENT = 100
const INSTALL_PROGRESS_STEP_MS =
  INSTALL_PROGRESS_DURATION_MS / (INSTALL_PROGRESS_MAX_PERCENT / INSTALL_PROGRESS_STEP_PERCENT)
const POST_INSTALL_ACTION_DELAY_MS = INSTALL_PROGRESS_DURATION_MS
const POST_INSTALL_EVENT_ACTION_DELAY_MS = 300
const ANDROID_POST_INSTALL_AUTO_OPEN_START_MS = INSTALL_PROGRESS_DURATION_MS
const ANDROID_POST_INSTALL_AUTO_OPEN_INTERVAL_MS = 1000
const ANDROID_POST_INSTALL_ACTION_DELAY_MS = 20000
const ANDROID_INSTALL_PROMPT_WAIT_MS = 32000
const DEFAULT_INSTALL_PROMPT_WAIT_MS = 6000

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
} = usePwaAddToHomeAction()
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
let androidPostInstallAutoOpenStartTimer = null
let androidPostInstallAutoOpenRetryTimer = null
let postInstallActionStarted = false
let openBrowserGuideAutoOpenAttempted = false
let toastTimer = null

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

const pwaLink = computed(
  () => props.pwaInfo?.h5_url || props.pwaInfo?.h5Url || props.pwaInfo?.pwa_url || FALLBACK_PWA_LINK,
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
const isFeishuInAppBrowser = computed(() => resolveIsFeishuInAppBrowser())
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
  () => shouldUseOpenBrowserGuide.value && isFeishuInAppBrowser.value,
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
const installLabel = computed(() => {
  if (installVisualActive.value) return t('pwaPage.install.installingProgress')
  if (postInstallOpenRequested.value) return t('pwaPage.install.playNow')
  if (isInstalled.value || isStandalone.value) return t('pwaPage.install.playNow')
  if (isApplePwaRedirectDevice.value) return t('pwaPage.install.playNow')

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

  if (!isApplePwaRedirectDevice.value && !canPromptInstall.value) {
    await waitForInstallPrompt(options)
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

  return /Lark|Feishu|LarkLocale|FBAN|FBAV|FB_IAB|Instagram|Line|MicroMessenger|DingTalk|Twitter|WhatsApp/i.test(
    userAgent,
  )
}

function resolveIsFeishuInAppBrowser() {
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

    return targetUrl.toString()
  } catch {
    return url
  }
}

function redirectToPwaDownload() {
  if (typeof window === 'undefined') return

  window.location.href = resolvePwaRedirectUrl(pwaLink.value || FALLBACK_PWA_LINK)
}

function startInstallVisualState() {
  postInstallOpenRequested.value = false
  postInstallActionStarted = false
  installVisualActive.value = true
  startInstallProgressTimer()
}

function resetInstallLoadingState() {
  installing.value = false
  installVisualActive.value = false
  clearInstallProgressTimer()
  clearAndroidPostInstallAutoOpenTimers()
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

function clearAndroidPostInstallAutoOpenTimers() {
  if (typeof window === 'undefined') {
    androidPostInstallAutoOpenStartTimer = null
    androidPostInstallAutoOpenRetryTimer = null
    return
  }

  if (androidPostInstallAutoOpenStartTimer) {
    window.clearTimeout(androidPostInstallAutoOpenStartTimer)
    androidPostInstallAutoOpenStartTimer = null
  }

  if (androidPostInstallAutoOpenRetryTimer) {
    window.clearInterval(androidPostInstallAutoOpenRetryTimer)
    androidPostInstallAutoOpenRetryTimer = null
  }
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
    }
  }, INSTALL_PROGRESS_STEP_MS)
}

function shouldShowInstalledOpenPopup() {
  if (typeof document === 'undefined') return false

  return document.visibilityState !== 'hidden' && !isStandalone.value
}

function openInstalledOpenPopup() {
  if (!shouldShowInstalledOpenPopup()) return

  showInstalledOpenPopup.value = true
}

function resolvePostInstallActionDelay(delay) {
  if (Number.isFinite(delay)) return delay

  return isAndroidPwaInstallDevice.value
    ? ANDROID_POST_INSTALL_ACTION_DELAY_MS
    : POST_INSTALL_ACTION_DELAY_MS
}

function shouldRunAndroidPostInstallAutoOpen() {
  if (!isAndroidPwaInstallDevice.value || isStandalone.value || postInstallActionStarted) return false
  if (typeof document === 'undefined') return false

  return document.visibilityState !== 'hidden'
}

function tryOpenInstalledPwaAppOnly() {
  return silentlyTryOpenInstalledPwa({
    launchMode: isAndroidPwaInstallDevice.value ? 'android_intent' : 'protocol',
  })
}

function runAndroidPostInstallAutoOpenAttempt() {
  if (!shouldRunAndroidPostInstallAutoOpen()) {
    clearAndroidPostInstallAutoOpenTimers()
    return
  }

  tryOpenInstalledPwaAppOnly()
}

function startAndroidPostInstallAutoOpenRetries() {
  if (androidPostInstallAutoOpenRetryTimer || !shouldRunAndroidPostInstallAutoOpen()) return

  runAndroidPostInstallAutoOpenAttempt()
  androidPostInstallAutoOpenRetryTimer = window.setInterval(
    runAndroidPostInstallAutoOpenAttempt,
    ANDROID_POST_INSTALL_AUTO_OPEN_INTERVAL_MS,
  )
}

function scheduleAndroidPostInstallAutoOpenRetries() {
  if (typeof window === 'undefined' || !isAndroidPwaInstallDevice.value || isStandalone.value) return

  clearAndroidPostInstallAutoOpenTimers()
  androidPostInstallAutoOpenStartTimer = window.setTimeout(() => {
    androidPostInstallAutoOpenStartTimer = null
    startAndroidPostInstallAutoOpenRetries()
  }, ANDROID_POST_INSTALL_AUTO_OPEN_START_MS)
}

function runPostInstallAction() {
  clearPostInstallActionTimer()
  clearAndroidPostInstallAutoOpenTimers()

  if (postInstallActionStarted || isStandalone.value) return

  postInstallActionStarted = true
  clearInstallProgressTimer()
  installProgressPercent.value = INSTALL_PROGRESS_MAX_PERCENT

  openInstalledOpenPopup()
}

function schedulePostInstallAction(delay) {
  if (typeof window === 'undefined' || isStandalone.value) return

  clearPostInstallActionTimer()
  postInstallActionTimer = window.setTimeout(() => {
    postInstallActionTimer = null
    runPostInstallAction()
  }, resolvePostInstallActionDelay(delay))
}

function handleInstalledOpen() {
  showInstalledOpenPopup.value = false
  postInstallOpenRequested.value = true
  resetInstallLoadingState()
  silentlyTryOpenInstalledPwa()
}

function handleInstalledDesktopOpen() {
  showInstalledOpenPopup.value = false
  postInstallOpenRequested.value = true
  resetInstallLoadingState()
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

    return `intent://${path}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallbackUrl};end`
  } catch {
    return url
  }
}

function maybeAutoOpenExternalBrowserFromGuide() {
  if (!shouldLockOpenBrowserGuide.value || openBrowserGuideAutoOpenAttempted) return
  if (typeof window === 'undefined') return

  openBrowserGuideAutoOpenAttempted = true
  window.setTimeout(openCurrentPageInExternalBrowser, 0)
}

function openExternalBrowserGuide(options = {}) {
  showOpenBrowserGuide.value = true

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

function silentlyTryOpenInstalledPwa(options = {}) {
  const launchMode =
    options.launchMode || (isAndroidPwaInstallDevice.value ? 'android_intent' : 'protocol')
  const result = tryOpenInstalledPwa({
    ...options,
    fallback: false,
    launchMode,
    target: options.target || '_self',
  })

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
    silentlyTryOpenInstalledPwa()
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
      scheduleAndroidPostInstallAutoOpenRetries()
      schedulePostInstallAction()
      showLocalToast(t('pwaPage.install.accepted'))
      return
    }

    if (result.outcome === 'ready') {
      showLocalToast(t('pwaPage.install.ready'))
      return
    }

    if (result.outcome === 'installed') {
      silentlyTryOpenInstalledPwa()
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

  redirectToPwaDownload()
}

function handlePopupDownload(controller) {
  if (installing.value || installVisualActive.value) return
  if (isStandalone.value) return

  if (postInstallOpenRequested.value) {
    silentlyTryOpenInstalledPwa()
    controller?.finish?.({ repeat: false })
    return
  }

  if (shouldAttemptInstalledPwaOpen()) {
    silentlyTryOpenInstalledPwa()
    controller?.finish?.({ repeat: false })
    return
  }

  if (shouldUseOpenBrowserGuide.value) {
    openExternalBrowserGuide({ autoOpen: shouldLockOpenBrowserGuide.value })
    controller?.finish?.({ repeat: false })
    return
  }

  if (isApplePwaRedirectDevice.value) {
    redirectToPwaDownload()
    controller?.finish?.({ repeat: false })
    return
  }

  void runNativeInstallPrompt().finally(() => {
    controller?.finish?.({ repeat: false })
  })
}

onMounted(() => {
  void prepareInstallPrompt().finally(() => {
    installPromptProbeFinished.value = true
  })
  void setupQrCode()

  if (shouldUseOpenBrowserGuide.value) {
    openExternalBrowserGuide({ autoOpen: shouldLockOpenBrowserGuide.value })
  }
})

onBeforeUnmount(() => {
  clearPostInstallActionTimer()
  clearInstallProgressTimer()
  clearAndroidPostInstallAutoOpenTimers()
  teardownQrCode()
  if (toastTimer) window.clearTimeout(toastTimer)
})

watch(isInstalled, (installed) => {
  if (!installed || !installVisualActive.value || postInstallActionStarted) return
  if (isAndroidPwaInstallDevice.value) return

  clearPostInstallActionTimer()
  schedulePostInstallAction(POST_INSTALL_EVENT_ACTION_DELAY_MS)
})

watch(showOpenBrowserGuide, (visible) => {
  if (visible || !shouldLockOpenBrowserGuide.value) return

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
        @desktop="handleInstalledDesktopOpen"
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
