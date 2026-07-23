const MANIFEST_CACHE_NAME = 'pwa-shell-manifest-v2'
const SW_VERSION = 'pwa-shell-runtime-v8'
const APP_CACHE_NAME = SW_VERSION
const APP_CACHE_PREFIX = 'pwa-shell-runtime-'
const NOTIFICATION_NAVIGATION_CACHE_NAME = 'pwa-shell-notification-navigation-v1'
const NOTIFICATION_NAVIGATION_CACHE_PATH = '/__pwa_shell_notification_navigation__'
const NOTIFICATION_NAVIGATION_MESSAGE_TYPE = 'PWA_SHELL_NOTIFICATION_NAVIGATE'
const LEGACY_CACHE_NAMES = ['h5slot-pwa-manifest', 'pwa-shell-manifest']
const DYNAMIC_MANIFEST_PATH = '/pwa-dynamic-manifest.webmanifest'
const STATIC_MANIFEST_PATH = '/manifest.webmanifest'
const APP_SHELL_PATH = '/'
const DEFAULT_NOTIFICATION_ICON = '/pwa-icons/icon-192.png'
const DEFAULT_NOTIFICATION_BADGE = '/pwa-icons/icon-192.png'
const DEFAULT_NOTIFICATION_TITLE = 'SlotFront H5'
const CORE_ASSET_PATHS = [
  APP_SHELL_PATH,
  DYNAMIC_MANIFEST_PATH,
  STATIC_MANIFEST_PATH,
  '/pwa-icons/icon-192.png',
  '/pwa-icons/icon-512.png',
  '/pwa-source/install-1.png',
  '/pwa-source/install-2.png',
  '/pwa-source/install-3.png',
]
const FALLBACK_MANIFEST = {
  id: '/',
  name: 'SlotFront H5',
  short_name: 'SlotFront H5',
  description:
    'Welcome to our entertainment platform, designed to bring you a smooth, exciting, and enjoyable experience anytime, anywhere.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: '#ffffff',
  background_color: '#ffffff',
  prefer_related_applications: false,
  related_applications: [
    {
      platform: 'webapp',
      url: '/manifest.webmanifest',
    },
    {
      platform: 'webapp',
      url: '/pwa-dynamic-manifest.webmanifest',
    },
  ],
  protocol_handlers: [
    {
      protocol: 'web+hslot',
      url: '/?protocol_url=%s',
    },
  ],
  icons: [
    {
      src: '/pwa-icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: '/pwa-icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
  screenshots: [
    {
      src: '/pwa-source/install-1.png',
      sizes: '488x1055',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Games home screen',
    },
    {
      src: '/pwa-source/install-2.png',
      sizes: '488x1055',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Referral bonus screen',
    },
    {
      src: '/pwa-source/install-3.png',
      sizes: '488x1055',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Recharge promotion screen',
    },
  ],
  lang: 'en',
  dir: 'ltr',
}

async function cacheCoreAssets() {
  const cache = await caches.open(APP_CACHE_NAME)

  await Promise.all(
    CORE_ASSET_PATHS.map((path) =>
      cache.add(path).catch(() => {
        // Optional warmup only; installability should not depend on every asset being cached.
      }),
    ),
  )
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys()

  await Promise.all(
    cacheNames
      .filter((cacheName) => {
        return (
          LEGACY_CACHE_NAMES.includes(cacheName) ||
          (cacheName.startsWith(APP_CACHE_PREFIX) && cacheName !== APP_CACHE_NAME)
        )
      })
      .map((cacheName) => caches.delete(cacheName)),
  )
}

function isUsableManifestResponse(response) {
  if (!response?.ok) return false

  const contentType = response.headers.get('Content-Type') || ''
  return !/text\/html/i.test(contentType)
}

function createFallbackManifestResponse() {
  return new Response(JSON.stringify(FALLBACK_MANIFEST), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function parseJsonPayload(data) {
  if (!data) return {}

  try {
    return data.json()
  } catch {
    try {
      return JSON.parse(data.text())
    } catch {
      return {}
    }
  }
}

function normalizeRedirect(value) {
  if (typeof value !== 'string') return ''

  try {
    const targetUrl = new URL(value, self.location.origin)

    if (targetUrl.origin !== self.location.origin || !targetUrl.pathname.startsWith('/')) {
      return ''
    }

    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
  } catch {
    return ''
  }
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) return { actions: [], redirects: {} }

  return actions.reduce(
    (result, item) => {
      if (!item || typeof item !== 'object') return result

      const action = typeof item.action === 'string' ? item.action.trim() : ''
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const redirect = normalizeRedirect(item.url || item.redirect || item.link || '')

      if (!action || !title || !redirect) return result

      result.actions.push({ action, title, icon: item.icon || undefined })
      result.redirects[action] = redirect
      return result
    },
    { actions: [], redirects: {} },
  )
}

function normalizeNotificationPayload(payload = {}) {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const data = safePayload.data && typeof safePayload.data === 'object' ? safePayload.data : {}
  const notification =
    safePayload.notification && typeof safePayload.notification === 'object'
      ? safePayload.notification
      : data.notification && typeof data.notification === 'object'
        ? data.notification
        : {}
  const notificationId =
    safePayload.notificationId || notification.notificationId || data.notificationId || data.id || ''
  const tag =
    safePayload.tag ||
    notification.tag ||
    data.tag ||
    (notificationId ? `pwa-shell-${notificationId}` : `pwa-shell-${Date.now()}`)
  const timestamp = Number(safePayload.timestamp ?? notification.timestamp ?? data.timestamp)
  const actionConfig = normalizeActions(safePayload.actions || notification.actions || data.actions)
  const redirect = normalizeRedirect(
    safePayload.url || safePayload.redirect || notification.url || notification.redirect || data.url || data.redirect || '',
  )
  const options = {
    body: safePayload.body || notification.body || data.body || '',
    icon: safePayload.icon || notification.icon || data.icon || DEFAULT_NOTIFICATION_ICON,
    badge: safePayload.badge || notification.badge || data.badge || DEFAULT_NOTIFICATION_BADGE,
    image: safePayload.image || notification.image || data.image || undefined,
    tag,
    renotify: Boolean(safePayload.renotify ?? notification.renotify ?? data.renotify),
    requireInteraction: Boolean(
      safePayload.requireInteraction ?? notification.requireInteraction ?? data.requireInteraction,
    ),
    data: {
      ...data,
      notificationId: String(notificationId || ''),
      redirect,
      actionRedirects: actionConfig.redirects,
    },
  }

  if (actionConfig.actions.length) options.actions = actionConfig.actions
  if (!options.image) delete options.image
  if (Number.isFinite(timestamp) && timestamp > 0) options.timestamp = timestamp

  return {
    title: safePayload.title || notification.title || data.title || DEFAULT_NOTIFICATION_TITLE,
    options,
  }
}

async function broadcastNotification(payload, source) {
  const notification = normalizeNotificationPayload(payload)
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

  clients.forEach((client) => {
    client.postMessage({
      type: 'PWA_SHELL_NOTIFICATION_RECEIVED',
      source,
      notification: {
        title: notification.title,
        body: notification.options.body,
        tag: notification.options.tag,
        redirect: notification.options.data.redirect,
        data: notification.options.data,
      },
    })
  })
}

function handleNotificationPayload(payload, source = 'push') {
  const notification = normalizeNotificationPayload(payload)

  return Promise.all([
    self.registration.showNotification(notification.title, notification.options),
    broadcastNotification(payload, source),
  ])
}

function createNotificationNavigation(redirect) {
  const safeRedirect = normalizeRedirect(redirect)

  const navigationId =
    typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `pwa-shell-${Date.now()}-${Math.random().toString(16).slice(2)}`

  return {
    id: navigationId,
    url: safeRedirect ? new URL(safeRedirect, self.location.origin).toString() : '',
  }
}

function getNotificationNavigationRequest() {
  return new Request(
    new URL(NOTIFICATION_NAVIGATION_CACHE_PATH, self.location.origin).toString(),
  )
}

async function saveNotificationNavigation(navigation) {
  if (!navigation) return

  const cache = await caches.open(NOTIFICATION_NAVIGATION_CACHE_NAME)
  await cache.put(
    getNotificationNavigationRequest(),
    new Response(JSON.stringify(navigation), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }),
  )
}

async function openOrFocusShellWindow(navigation) {
  if (navigation) {
    try {
      await saveNotificationNavigation(navigation)
    } catch {
      // An already-open shell can still consume the direct postMessage below.
    }
  }

  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const sameOriginClient = clients.find((client) => {
    try {
      return new URL(client.url).origin === self.location.origin
    } catch {
      return false
    }
  })

  if (sameOriginClient) {
    try {
      if (navigation) {
        sameOriginClient.postMessage({
          type: NOTIFICATION_NAVIGATION_MESSAGE_TYPE,
          navigation,
        })
      }

      return await sameOriginClient.focus()
    } catch {
      // A stale client can reject focus. Opening the default shell is still valid.
    }
  }

  return self.clients.openWindow(new URL(APP_SHELL_PATH, self.location.origin).toString())
}

async function fetchStaticManifestFallback() {
  try {
    const response = await fetch(STATIC_MANIFEST_PATH, {
      cache: 'no-store',
    })

    if (isUsableManifestResponse(response)) return response
  } catch {
    // The generated fallback below keeps installability alive when the network path fails.
  }

  return createFallbackManifestResponse()
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheCoreAssets())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([cleanupOldCaches(), self.clients.claim()]))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'PWA_SHELL_SW_VERSION') {
    event.source?.postMessage({ type: 'PWA_SHELL_SW_VERSION', version: SW_VERSION })
    return
  }

  if (event.data?.type === 'PWA_SHELL_SHOW_NOTIFICATION') {
    event.waitUntil(handleNotificationPayload(event.data.payload || {}, 'simulate'))
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)

  if (requestUrl.origin !== self.location.origin) {
    return
  }

  if (requestUrl.pathname === DYNAMIC_MANIFEST_PATH) {
    event.respondWith(
      caches
        .open(MANIFEST_CACHE_NAME)
        .then((cache) => cache.match(DYNAMIC_MANIFEST_PATH))
        .then((response) => response || fetch(event.request))
        .then((response) => (isUsableManifestResponse(response) ? response : fetchStaticManifestFallback()))
        .catch(fetchStaticManifestFallback),
    )
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          const cache = await caches.open(APP_CACHE_NAME)
          cache.put(APP_SHELL_PATH, response.clone()).catch(() => {})
          return response
        })
        .catch(async () => {
          const cache = await caches.open(APP_CACHE_NAME)
          return (await cache.match(event.request)) || (await cache.match(APP_SHELL_PATH))
        }),
    )
    return
  }

  if (
    requestUrl.pathname === STATIC_MANIFEST_PATH ||
    requestUrl.pathname.startsWith('/pwa-icons/') ||
    requestUrl.pathname.startsWith('/pwa-source/')
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cachedResponse) =>
          cachedResponse ||
          fetch(event.request).then((response) => {
            const responseClone = response.clone()
            caches
              .open(APP_CACHE_NAME)
              .then((cache) => cache.put(event.request, responseClone))
              .catch(() => {})
            return response
          }),
      ),
    )
  }
})

self.addEventListener('push', (event) => {
  event.waitUntil(handleNotificationPayload(parseJsonPayload(event.data), 'push'))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const actionRedirects = event.notification.data?.actionRedirects || {}
  const redirect =
    (event.action && typeof actionRedirects[event.action] === 'string'
      ? actionRedirects[event.action]
      : '') || event.notification.data?.redirect
  const navigation = createNotificationNavigation(redirect)

  event.waitUntil(openOrFocusShellWindow(navigation))
})
