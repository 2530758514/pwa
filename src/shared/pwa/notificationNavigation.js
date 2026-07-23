export const PWA_SHELL_NOTIFICATION_NAVIGATE = 'PWA_SHELL_NOTIFICATION_NAVIGATE'
export const H5_NOTIFICATION_NAVIGATE = 'H5SLOT_NOTIFICATION_NAVIGATE'
export const H5_NOTIFICATION_NAVIGATION_READY = 'H5SLOT_NOTIFICATION_NAVIGATION_READY'
export const H5_NOTIFICATION_NAVIGATION_APPLIED = 'H5SLOT_NOTIFICATION_NAVIGATION_APPLIED'

const NOTIFICATION_NAVIGATION_CACHE_NAME = 'pwa-shell-notification-navigation-v1'
const NOTIFICATION_NAVIGATION_CACHE_PATH = '/__pwa_shell_notification_navigation__'

function canUseCacheStorage() {
  return typeof window !== 'undefined' && 'caches' in window
}

function getNavigationRequest() {
  return new Request(
    new URL(NOTIFICATION_NAVIGATION_CACHE_PATH, window.location.origin).toString(),
  )
}

export function normalizeNotificationNavigation(payload) {
  if (!payload || typeof payload.id !== 'string') {
    return null
  }

  if (!payload.url) {
    return {
      id: payload.id,
      location: '',
    }
  }

  if (typeof payload.url !== 'string') return null

  try {
    const targetUrl = new URL(payload.url, window.location.origin)

    if (targetUrl.origin !== window.location.origin || !targetUrl.pathname.startsWith('/')) {
      return null
    }

    return {
      id: payload.id,
      location: `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`,
    }
  } catch {
    return null
  }
}

export async function readPendingNotificationNavigation() {
  if (!canUseCacheStorage()) return null

  try {
    const cache = await caches.open(NOTIFICATION_NAVIGATION_CACHE_NAME)
    const response = await cache.match(getNavigationRequest())

    if (!response) return null

    return normalizeNotificationNavigation(await response.json())
  } catch {
    return null
  }
}

export async function clearPendingNotificationNavigation(navigationId) {
  if (!canUseCacheStorage() || typeof navigationId !== 'string' || !navigationId) {
    return false
  }

  try {
    const cache = await caches.open(NOTIFICATION_NAVIGATION_CACHE_NAME)
    const request = getNavigationRequest()
    const response = await cache.match(request)

    if (!response) return false

    const navigation = normalizeNotificationNavigation(await response.json())

    if (navigation?.id !== navigationId) return false

    return cache.delete(request)
  } catch {
    return false
  }
}
