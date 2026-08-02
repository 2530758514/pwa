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
  const path = `${launchUrl.host}${launchUrl.pathname}${launchUrl.search}${launchUrl.hash}`
  const fallbackUrl = String(options.fallbackUrl || '').trim()
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
  const fallbackDueAt = Date.now() + fallbackDelay
  const fallbackExpiresAt = fallbackDueAt + (options.fallbackReturnGrace ?? 1000)
  let fallbackTimer = null
  let fallbackExpiryTimer = null
  let launchLeftPage = false

  function cleanup() {
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
    if (fallbackExpiryTimer) {
      window.clearTimeout(fallbackExpiryTimer)
      fallbackExpiryTimer = null
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('pagehide', handlePageHide)
    window.removeEventListener('pageshow', handlePageShow)
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

  function handlePageVisible() {
    const now = Date.now()

    if (now < fallbackDueAt) {
      launchLeftPage = false
      return
    }

    if (now <= fallbackExpiresAt) {
      runFallback()
      return
    }

    cleanup()
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      launchLeftPage = true
      return
    }

    handlePageVisible()
  }

  function handlePageHide() {
    launchLeftPage = true
  }

  function handlePageShow() {
    handlePageVisible()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
  fallbackTimer = window.setTimeout(() => {
    fallbackTimer = null
    if (document.visibilityState === 'hidden') return
    if (launchLeftPage && Date.now() > fallbackExpiresAt) {
      cleanup()
      return
    }

    runFallback()
  }, fallbackDelay)
  fallbackExpiryTimer = window.setTimeout(() => {
    fallbackExpiryTimer = null
    if (document.visibilityState === 'hidden') {
      cleanup()
    }
  }, fallbackExpiresAt - Date.now())

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

    try {
      const launchMode = resolveLaunchMode(options)

      if (launchMode === 'android_intent') {
        const cancelFallback =
          options.fallback !== false ? scheduleVisibilityFallback(options) : null

        try {
          if (options.topLevel === true) {
            navigateTopLevel(createAndroidIntentLaunchUrl(options))
          } else {
            clickLaunchLink(createAndroidIntentLaunchUrl(options), options)
          }
        } catch (error) {
          cancelFallback?.()
          throw error
        }
      } else if (launchMode === 'protocol') {
        if (options.topLevel === true) {
          navigateTopLevel(createProtocolLaunchUrl())
        } else {
          const cancelFallback =
            options.fallback !== false ? scheduleVisibilityFallback(options) : null

          try {
            clickLaunchLink(createProtocolLaunchUrl(), options)
          } catch (error) {
            cancelFallback?.()
            throw error
          }
        }
      } else if (options.topLevel === true) {
        navigateTopLevel(createStartUrlLaunchUrl(options))
      } else {
        clickLaunchLink(createStartUrlLaunchUrl(options), options)
      }

      return { outcome: 'attempted' }
    } catch (error) {
      return { outcome: 'failed', error }
    }
  }

  return {
    resolveInstalledPwaLaunchUrl,
    tryOpenInstalledPwa,
  }
}
