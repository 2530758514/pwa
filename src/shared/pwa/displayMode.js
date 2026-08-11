function isBrowserRuntime() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined'
}

const PWA_SHELL_LAUNCH_PARAM = 'pwa_launch'
const PWA_SHELL_LAUNCH_VALUE = '1'

function hasPwaLaunchParam(url) {
  return url.searchParams.get(PWA_SHELL_LAUNCH_PARAM) === PWA_SHELL_LAUNCH_VALUE
}

export function isPwaShellLaunchUrl(value) {
  try {
    const url = new URL(String(value || ''), 'https://pwa-shell.invalid')
    if (hasPwaLaunchParam(url)) return true

    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    if (hashParams.get(PWA_SHELL_LAUNCH_PARAM) === PWA_SHELL_LAUNCH_VALUE) return true

    const protocolUrl = hashParams.get('protocol_url')
    return protocolUrl ? hasPwaLaunchParam(new URL(protocolUrl)) : false
  } catch {
    return false
  }
}

function resolveIsAppleDevice() {
  if (!isBrowserRuntime()) return false

  const userAgent = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent) || /iPad|iPhone|iPod/i.test(platform)
  const isTouchMac =
    /Macintosh|MacIntel/i.test(`${userAgent} ${platform}`) && navigator.maxTouchPoints > 1

  return isIOS || isTouchMac
}

export function resolveIsPwaStandalone() {
  if (!isBrowserRuntime()) return false

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator?.standalone === true
  )
}

export function resolveIsPwaShellRuntime() {
  if (!isBrowserRuntime()) return false

  return resolveIsPwaStandalone() || isPwaShellLaunchUrl(window.location.href)
}

function syncPwaDisplayModeClasses() {
  if (typeof document === 'undefined') return

  const isAppleDevice = resolveIsAppleDevice()
  const isPwaStandalone = resolveIsPwaStandalone()
  const isIosPwa = isAppleDevice && isPwaStandalone
  const isIosBrowser = isAppleDevice && !isPwaStandalone

  document.documentElement.classList.toggle('is-ios-pwa', isIosPwa)
  document.documentElement.classList.toggle('is-ios-browser', isIosBrowser)
  document.body?.classList.toggle('is-ios-pwa', isIosPwa)
  document.body?.classList.toggle('is-ios-browser', isIosBrowser)
}

export function initializePwaDisplayModeClasses() {
  if (!isBrowserRuntime()) return

  syncPwaDisplayModeClasses()

  const displayModeQuery = window.matchMedia?.('(display-mode: standalone)')
  displayModeQuery?.addEventListener?.('change', syncPwaDisplayModeClasses)
  window.addEventListener('pageshow', syncPwaDisplayModeClasses)
}
