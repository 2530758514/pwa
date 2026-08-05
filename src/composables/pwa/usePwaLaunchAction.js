import { PWA_PROTOCOL, getStoredPwaManifestInfo } from '@/shared/pwa/manifest'

function isBrowserRuntime() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

const PWA_PROTOCOL_LAUNCH_URL = `${PWA_PROTOCOL}:open`
const PWA_START_LAUNCH_PATH = '/'
const ANDROID_INTENT_ACTION_VIEW = 'android.intent.action.VIEW'
const ANDROID_INTENT_CATEGORY_BROWSABLE = 'android.intent.category.BROWSABLE'

function appendCurrentSearchParams(targetUrl) {
  const currentUrl = new URL(window.location.href)

  currentUrl.searchParams.forEach((value, key) => {
    if (!key || targetUrl.searchParams.has(key)) return

    targetUrl.searchParams.append(key, value)
  })
}

function appendPwaLaunchParams(targetUrl) {
  targetUrl.searchParams.set('pwa_launch', '1')
  targetUrl.searchParams.set('pwa_launch_time', String(Date.now()))
}

function createProtocolLaunchUrl() {
  const targetUrl = new URL(PWA_PROTOCOL_LAUNCH_URL)

  appendCurrentSearchParams(targetUrl)
  appendPwaLaunchParams(targetUrl)

  return targetUrl.toString()
}

function getStoredInstallManifest() {
  return getStoredPwaManifestInfo()?.manifest || null
}

function resolveStartLaunchPath(options = {}) {
  const explicitPath = String(options.url || options.path || '').trim()

  if (explicitPath) return explicitPath

  const startUrl = String(getStoredInstallManifest()?.start_url || '').trim()

  return startUrl || PWA_START_LAUNCH_PATH
}

function createStartUrlLaunchUrl(options = {}) {
  const path = resolveStartLaunchPath(options)
  const targetUrl = new URL(path, window.location.origin)

  appendCurrentSearchParams(targetUrl)
  appendPwaLaunchParams(targetUrl)

  return targetUrl.toString()
}

function resolveFallbackLaunchUrl(options = {}) {
  const explicitFallbackUrl = String(options.fallbackUrl || '').trim()

  if (explicitFallbackUrl) {
    return new URL(explicitFallbackUrl, window.location.href).toString()
  }

  return createStartUrlLaunchUrl(options)
}

function createAndroidIntentLaunchUrl(options = {}) {
  const launchUrl = new URL(createStartUrlLaunchUrl(options))
  const scheme = launchUrl.protocol.replace(':', '') || 'https'
  const path = `${launchUrl.host}${launchUrl.pathname}${launchUrl.search}`
  const fallbackUrl =
    options.intentBrowserFallback === false ? '' : String(options.fallbackUrl || '').trim()
  const fallbackExtra = fallbackUrl
    ? `S.browser_fallback_url=${encodeURIComponent(resolveFallbackLaunchUrl(options))};`
    : ''

  return `intent://${path}#Intent;scheme=${scheme};action=${ANDROID_INTENT_ACTION_VIEW};category=${ANDROID_INTENT_CATEGORY_BROWSABLE};${fallbackExtra}end`
}

function clickLaunchLink(url, options = {}) {
  const link = document.createElement('a')

  link.href = url
  link.target = options.target || '_blank'
  link.rel = 'noopener noreferrer'
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()
}

function navigateTopLevel(url) {
  window.location.assign(url)
}

function scheduleVisibilityFallback(options = {}) {
  const fallbackDelay = options.fallbackDelay ?? 1200
  let fallbackTimer = null

  function cleanup() {
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('pagehide', handlePageHide)
  }

  function runFallback() {
    cleanup()

    const fallbackUrl = resolveFallbackLaunchUrl(options)
    options.onFallback?.()

    if (options.fallbackTopLevel === true) {
      navigateTopLevel(fallbackUrl)
      return
    }

    clickLaunchLink(fallbackUrl, options)
  }

  function handleLaunchDetected() {
    cleanup()
    options.onLaunchDetected?.()
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      handleLaunchDetected()
    }
  }

  function handlePageHide() {
    handleLaunchDetected()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pagehide', handlePageHide)
  fallbackTimer = window.setTimeout(() => {
    fallbackTimer = null
    if (document.visibilityState === 'hidden') {
      handleLaunchDetected()
      return
    }

    runFallback()
  }, fallbackDelay)

  return cleanup
}

function hasProtocolHandler() {
  const protocolHandlers = getStoredInstallManifest()?.protocol_handlers

  if (!Array.isArray(protocolHandlers)) return true

  return protocolHandlers.some((handler) => handler?.protocol === PWA_PROTOCOL)
}

function resolveLaunchMode(options = {}) {
  const launchMode = options.launchMode || 'auto'

  if (launchMode !== 'auto') return launchMode

  return hasProtocolHandler() ? 'protocol' : 'start_url'
}

export function usePwaLaunchAction() {
  function resolveInstalledPwaLaunchUrl(options = {}) {
    if (!isBrowserRuntime()) return ''

    try {
      const launchMode = resolveLaunchMode(options)

      if (launchMode === 'android_intent') return createAndroidIntentLaunchUrl(options)
      if (launchMode === 'protocol') return createProtocolLaunchUrl()

      return createStartUrlLaunchUrl(options)
    } catch {
      return ''
    }
  }

  function tryOpenInstalledPwa(options = {}) {
    if (!isBrowserRuntime()) return { outcome: 'unavailable' }

    let cancelFallback = null

    try {
      const launchMode = resolveLaunchMode(options)

      if (launchMode === 'android_intent') {
        cancelFallback =
          options.fallback !== false ? scheduleVisibilityFallback(options) : null

        if (options.topLevel === true) {
          navigateTopLevel(createAndroidIntentLaunchUrl(options))
        } else {
          clickLaunchLink(createAndroidIntentLaunchUrl(options), options)
        }
      } else if (launchMode === 'protocol') {
        if (options.topLevel === true) {
          navigateTopLevel(createProtocolLaunchUrl())
        } else {
          cancelFallback =
            options.fallback !== false ? scheduleVisibilityFallback(options) : null

          clickLaunchLink(createProtocolLaunchUrl(), options)
        }
      } else if (options.topLevel === true) {
        navigateTopLevel(createStartUrlLaunchUrl(options))
      } else {
        clickLaunchLink(createStartUrlLaunchUrl(options), options)
      }

      return { outcome: 'attempted', cancelFallback }
    } catch (error) {
      return { outcome: 'failed', error, cancelFallback }
    }
  }

  return {
    resolveInstalledPwaLaunchUrl,
    tryOpenInstalledPwa,
  }
}
