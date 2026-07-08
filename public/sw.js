const MANIFEST_CACHE_NAME = 'pwa-shell-manifest-v2'
const SW_VERSION = 'pwa-shell-runtime-v3'
const APP_CACHE_NAME = SW_VERSION
const APP_CACHE_PREFIX = 'pwa-shell-runtime-'
const LEGACY_CACHE_NAMES = ['h5slot-pwa-manifest', 'pwa-shell-manifest']
const DYNAMIC_MANIFEST_PATH = '/pwa-dynamic-manifest.webmanifest'
const STATIC_MANIFEST_PATH = '/manifest.webmanifest'
const APP_SHELL_PATH = '/'
const CORE_ASSET_PATHS = [
  APP_SHELL_PATH,
  DYNAMIC_MANIFEST_PATH,
  STATIC_MANIFEST_PATH,
  '/pwa-icons/icon-192.png',
  '/pwa-icons/icon-512.png',
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
