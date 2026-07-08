import { STORAGE_KEYS } from '@/shared/storage/keys'
import { storage } from '@/shared/storage/storage'

export const DEFAULT_MANIFEST_HREF = '/manifest.webmanifest'
export const DYNAMIC_MANIFEST_HREF = '/pwa-dynamic-manifest.webmanifest'
export const PWA_MANIFEST_SOURCE = String(import.meta.env.VITE_PWA_MANIFEST_SOURCE || 'dynamic')
  .trim()
  .toLowerCase()
const PWA_MANIFEST_CROSSORIGIN = String(import.meta.env.VITE_PWA_MANIFEST_CROSSORIGIN || 'anonymous')
  .trim()
  .toLowerCase()

const MANIFEST_CACHE_NAME = 'pwa-shell-manifest'
const MANIFEST_INFO_SCHEMA_VERSION = 2
const DEFAULT_ICON_192 = '/pwa-icons/icon-192.png'
const DEFAULT_ICON_512 = '/pwa-icons/icon-512.png'
const PWA_APP_ID_PATH = '/pwa'
const PWA_APP_SCOPE_PATH = '/'
const PWA_APP_START_PATH = '/pwa'
export const PWA_PROTOCOL = 'web+hslot'
export const PWA_PROTOCOL_HANDLER_URL = '/pwa?protocol_url=%s'
const PWA_APP_ID_URL = String(import.meta.env.VITE_PWA_APP_ID || '').trim()
const PWA_APP_SCOPE_URL = String(import.meta.env.VITE_PWA_APP_SCOPE || '').trim()
const PWA_APP_START_URL = String(import.meta.env.VITE_PWA_APP_START_URL || '').trim()
const SERVICE_WORKER_READY_WAIT_MS = 2500

let defaultManifestHref = ''

export function shouldUseLocalPwaManifest() {
  return PWA_MANIFEST_SOURCE !== 'dynamic'
}

function resolveManifestLink() {
  if (typeof document === 'undefined') return null

  let link = document.querySelector('link[rel="manifest"]')

  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }

  if (!defaultManifestHref) {
    defaultManifestHref = link.getAttribute('href') || ''
  }

  return link
}

function normalizeManifestUrl(value) {
  if (typeof value !== 'string') return ''

  const url = value.trim()
  if (!url || /^(?:javascript|vbscript):/i.test(url)) return ''

  if (typeof window === 'undefined') return url

  try {
    return new URL(url, window.location.origin).href
  } catch {
    return ''
  }
}

function resolveAbsoluteUrl(value, baseUrl) {
  if (typeof value !== 'string') return value

  const url = value.trim()
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url

  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

function normalizeTextValue(value) {
  return String(value || '').trim()
}

function normalizeDescriptionValue(value) {
  const description = normalizeTextValue(value).replace(/\s+/g, ' ')

  return description.length > 800 ? `${description.slice(0, 797)}...` : description
}

function inferImageMimeType(url) {
  const normalizedUrl = String(url || '')
    .split('?')[0]
    .split('#')[0]
    .toLowerCase()

  if (normalizedUrl.endsWith('.webp')) return 'image/webp'
  if (normalizedUrl.endsWith('.jpg') || normalizedUrl.endsWith('.jpeg')) return 'image/jpeg'
  if (normalizedUrl.endsWith('.svg')) return 'image/svg+xml'
  if (normalizedUrl.endsWith('.png')) return 'image/png'

  return ''
}

function normalizeManifestScreenshots(screenshots = []) {
  if (!Array.isArray(screenshots)) return []

  return screenshots
    .map((item) => {
      const src =
        typeof item === 'string'
          ? normalizeManifestUrl(item)
          : normalizeManifestUrl(item?.src || item?.url || item?.image || item?.image_url)

      if (!src) return null

      const type = item?.type || inferImageMimeType(src)

      return {
        src,
        sizes: item?.sizes || '390x844',
        ...(type ? { type } : {}),
        form_factor: item?.form_factor || item?.formFactor || 'narrow',
      }
    })
    .filter(Boolean)
}

function normalizeManifestOverrides(overrides = {}) {
  const name = normalizeTextValue(overrides.name || overrides.pwa_name || overrides.pwaName)
  const shortName = normalizeTextValue(overrides.short_name || overrides.shortName || name)
  const description = normalizeDescriptionValue(
    overrides.description ||
      overrides.store_description ||
      overrides.storeDescription ||
      overrides.introduction,
  )
  const iconSrc = normalizeManifestUrl(
    overrides.icon || overrides.logo || overrides.pwa_logo || overrides.pwaLogo,
  )
  const iconType = inferImageMimeType(iconSrc)
  const screenshots = normalizeManifestScreenshots(
    overrides.screenshots || overrides.pwa_carousel || overrides.pwaCarousel,
  )
  const nextOverrides = {}

  if (name) {
    nextOverrides.name = name
    nextOverrides.short_name = shortName || name
  }

  if (description) {
    nextOverrides.description = description
  }

  if (iconSrc) {
    nextOverrides.icons = [192, 512].map((size) => ({
      src: iconSrc,
      sizes: `${size}x${size}`,
      ...(iconType ? { type: iconType } : {}),
      purpose: 'any maskable',
    }))
  }

  if (screenshots.length) {
    nextOverrides.screenshots = screenshots
  }

  return nextOverrides
}

function getCurrentOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return ''
}

function getConfiguredAppBaseUrl() {
  const configuredUrl = PWA_APP_START_URL || PWA_APP_SCOPE_URL || PWA_APP_ID_URL

  if (configuredUrl) {
    try {
      return new URL(configuredUrl, getCurrentOrigin() || 'https://localhost/').href
    } catch {
      return ''
    }
  }

  const origin = getCurrentOrigin()
  return origin ? `${origin}/` : ''
}

function resolveManifestAppUrl(value, fallback = '/') {
  const source = String(value || fallback || '/').trim()
  const baseUrl = getConfiguredAppBaseUrl() || getCurrentOrigin() || 'https://localhost/'

  if (!source || /^(?:javascript|vbscript):/i.test(source)) return fallback

  try {
    const url = new URL(source, baseUrl)

    if (!/^https?:$/i.test(url.protocol)) return fallback

    if (typeof window !== 'undefined') {
      const currentOrigin = getCurrentOrigin()

      if (
        currentOrigin &&
        !PWA_APP_START_URL &&
        !PWA_APP_SCOPE_URL &&
        !PWA_APP_ID_URL &&
        url.origin !== currentOrigin
      ) {
        return fallback
      }
    }

    return /^(?:https?:)?\/\//i.test(source) || PWA_APP_START_URL || PWA_APP_SCOPE_URL || PWA_APP_ID_URL
      ? url.href
      : `${url.pathname || fallback}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

function resolveManifestName(manifest) {
  const name = String(manifest.name || manifest.short_name || '').trim()
  if (name) return name

  if (typeof document !== 'undefined') {
    return String(document.title || '').trim() || 'SlotFront H5'
  }

  return 'SlotFront H5'
}

function hasSizedIcon(icons, size) {
  return icons.some((icon) => {
    if (!icon?.src) return false

    return String(icon.sizes || '')
      .split(/\s+/)
      .includes(`${size}x${size}`)
  })
}

function ensureInstallIcons(icons = []) {
  const nextIcons = Array.isArray(icons) ? icons.filter((icon) => icon?.src) : []

  if (!hasSizedIcon(nextIcons, 192)) {
    nextIcons.push({
      src: DEFAULT_ICON_192,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    })
  }

  if (!hasSizedIcon(nextIcons, 512)) {
    nextIcons.push({
      src: DEFAULT_ICON_512,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    })
  }

  return nextIcons
}

function normalizeProtocolHandlers(protocolHandlers = []) {
  const handlers = Array.isArray(protocolHandlers)
    ? protocolHandlers.filter(
        (handler) => handler?.protocol && handler?.url && handler.protocol !== PWA_PROTOCOL,
      )
    : []

  handlers.push({
    protocol: PWA_PROTOCOL,
    url: PWA_PROTOCOL_HANDLER_URL,
  })

  return handlers
}

function normalizeLaunchHandler(launchHandler) {
  const clientMode = Array.isArray(launchHandler?.client_mode)
    ? launchHandler.client_mode.filter(Boolean)
    : []

  if (clientMode.length) {
    return {
      ...launchHandler,
      client_mode: clientMode,
    }
  }

  return null
}

function normalizeInstallableManifest(manifest) {
  const name = resolveManifestName(manifest)
  const shortName = String(manifest.short_name || manifest.shortName || name).trim()
  const startUrl = resolveManifestAppUrl(PWA_APP_START_URL || PWA_APP_START_PATH, PWA_APP_START_PATH)
  const scope = resolveManifestAppUrl(PWA_APP_SCOPE_URL || PWA_APP_SCOPE_PATH, PWA_APP_SCOPE_PATH)
  const id = resolveManifestAppUrl(PWA_APP_ID_URL || PWA_APP_ID_PATH, PWA_APP_ID_PATH)
  const protocolHandlers = normalizeProtocolHandlers(manifest.protocol_handlers)
  const launchHandler = normalizeLaunchHandler(manifest.launch_handler)

  return {
    ...manifest,
    name,
    short_name: shortName,
    id,
    start_url: startUrl,
    scope,
    display: manifest.display || 'standalone',
    background_color: manifest.background_color || '#ffffff',
    theme_color: manifest.theme_color || '#ffffff',
    prefer_related_applications: false,
    icons: ensureInstallIcons(manifest.icons),
    ...(protocolHandlers.length ? { protocol_handlers: protocolHandlers } : {}),
    ...(launchHandler ? { launch_handler: launchHandler } : {}),
  }
}

function normalizeManifestPayload(manifest, manifestUrl, overrides = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null

  const nextManifest = {
    ...manifest,
    ...normalizeManifestOverrides(overrides),
  }

  if (Array.isArray(nextManifest.icons)) {
    nextManifest.icons = nextManifest.icons.map((icon) => ({
      ...icon,
      src: resolveAbsoluteUrl(icon?.src, manifestUrl),
    }))
  }

  if (Array.isArray(nextManifest.screenshots)) {
    nextManifest.screenshots = nextManifest.screenshots.map((screenshot) => ({
      ...screenshot,
      src: resolveAbsoluteUrl(screenshot?.src, manifestUrl),
    }))
  }

  if (Array.isArray(nextManifest.shortcuts)) {
    nextManifest.shortcuts = nextManifest.shortcuts.map((shortcut) => ({
      ...shortcut,
      url: resolveAbsoluteUrl(shortcut?.url, manifestUrl),
      icons: Array.isArray(shortcut?.icons)
        ? shortcut.icons.map((icon) => ({
            ...icon,
            src: resolveAbsoluteUrl(icon?.src, manifestUrl),
          }))
        : shortcut?.icons,
    }))
  }

  return normalizeInstallableManifest(nextManifest)
}

function resolveManifestCrossOrigin(manifestHref) {
  if (!manifestHref || typeof window === 'undefined') return ''

  try {
    const manifestUrl = new URL(manifestHref, window.location.href)

    if (manifestUrl.origin === window.location.origin) return ''
  } catch {
    return ''
  }

  return PWA_MANIFEST_CROSSORIGIN === 'use-credentials' ? 'use-credentials' : 'anonymous'
}

function applyManifestLinkHref(link, manifestHref) {
  if (!manifestHref) {
    link.removeAttribute('href')
    link.removeAttribute('crossorigin')
    return ''
  }

  if (link.getAttribute('href') !== manifestHref) {
    link.setAttribute('href', manifestHref)
  }

  const crossOrigin = resolveManifestCrossOrigin(manifestHref)

  if (crossOrigin) {
    link.setAttribute('crossorigin', crossOrigin)
  } else {
    link.removeAttribute('crossorigin')
  }

  return manifestHref
}

function createManifestPayloadFromOverrides(overrides = {}) {
  return normalizeManifestPayload({}, getCurrentOrigin() || DEFAULT_MANIFEST_HREF, overrides)
}

function timeout(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve(null), ms)
  })
}

async function waitForActiveServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false

  const currentRegistration = await navigator.serviceWorker.getRegistration('/')
  if (currentRegistration?.active || navigator.serviceWorker.controller) return true

  const readyRegistration = await Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    timeout(SERVICE_WORKER_READY_WAIT_MS),
  ])

  return Boolean(readyRegistration?.active || navigator.serviceWorker.controller)
}

export function getStoredPwaManifestInfo() {
  const info = storage.get(STORAGE_KEYS.pwaManifestInfo, null)

  if (
    !info ||
    typeof info !== 'object' ||
    info.schemaVersion !== MANIFEST_INFO_SCHEMA_VERSION ||
    !info.manifest ||
    typeof info.manifest !== 'object'
  ) {
    return null
  }

  return info
}

export function getStoredPwaManifestUrl() {
  return normalizeManifestUrl(storage.get(STORAGE_KEYS.pwaManifestUrl, ''))
}

export function applyPwaManifestUrl(configUrl, options = {}) {
  const manifestUrl = normalizeManifestUrl(configUrl)
  const link = resolveManifestLink()

  if (!link) return ''

  const nextHref = manifestUrl || defaultManifestHref || DEFAULT_MANIFEST_HREF
  applyManifestLinkHref(link, nextHref)

  if (options.persist) {
    if (manifestUrl) {
      storage.set(STORAGE_KEYS.pwaManifestUrl, manifestUrl)
    } else {
      storage.remove(STORAGE_KEYS.pwaManifestUrl)
    }
  }

  return nextHref
}

export function applyPwaManifestInfo(info = getStoredPwaManifestInfo()) {
  const link = resolveManifestLink()

  if (!link || !info?.manifest) return ''

  const manifestHref = normalizeManifestUrl(info.manifestHref)

  if (!manifestHref) return ''

  return applyManifestLinkHref(link, manifestHref)
}

export function clearStoredPwaManifest() {
  storage.remove(STORAGE_KEYS.pwaManifestUrl)
  storage.remove(STORAGE_KEYS.pwaManifestInfo)
}

export function applyLocalPwaManifest(options = {}) {
  if (options.clearStored !== false) {
    clearStoredPwaManifest()
  }

  return applyPwaManifestUrl(DEFAULT_MANIFEST_HREF)
}

function ensureHeadMeta(selector, createElement) {
  if (typeof document === 'undefined') return null

  let element = document.head.querySelector(selector)

  if (!element) {
    element = createElement()
    document.head.appendChild(element)
  }

  return element
}

export function applyIosPwaMetadata(metadata = {}) {
  const name = normalizeTextValue(metadata.name)
  const icon = normalizeManifestUrl(metadata.icon || metadata.logo || metadata.pwa_logo || metadata.pwaLogo)

  if (name) {
    const appleTitle = ensureHeadMeta('meta[name="apple-mobile-web-app-title"]', () => {
      const element = document.createElement('meta')
      element.setAttribute('name', 'apple-mobile-web-app-title')
      return element
    })
    const applicationName = ensureHeadMeta('meta[name="application-name"]', () => {
      const element = document.createElement('meta')
      element.setAttribute('name', 'application-name')
      return element
    })

    appleTitle?.setAttribute('content', name)
    applicationName?.setAttribute('content', name)
  }

  if (icon) {
    const appleIcon = ensureHeadMeta('link[rel="apple-touch-icon"]', () => {
      const element = document.createElement('link')
      element.setAttribute('rel', 'apple-touch-icon')
      return element
    })

    appleIcon?.setAttribute('href', icon)
  }
}

export function applyStoredPwaManifestUrl() {
  if (shouldUseLocalPwaManifest()) {
    return applyLocalPwaManifest()
  }

  const manifestInfo = getStoredPwaManifestInfo()

  if (manifestInfo) {
    return applyPwaManifestInfo(manifestInfo)
  }

  const manifestUrl = getStoredPwaManifestUrl()

  if (manifestUrl) {
    return applyPwaManifestUrl(manifestUrl)
  }

  return applyPwaManifestUrl(DEFAULT_MANIFEST_HREF)
}

export async function fetchAndStorePwaManifest(configUrl, options = {}) {
  const manifestUrl = normalizeManifestUrl(configUrl)

  if (!manifestUrl) return null

  const response = await fetch(manifestUrl, {
    credentials: PWA_MANIFEST_CROSSORIGIN === 'use-credentials' ? 'include' : 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`PWA manifest request failed: ${response.status}`)
  }

  const manifest = normalizeManifestPayload(await response.json(), manifestUrl, options.manifestOverrides)

  if (!manifest) {
    throw new Error('PWA manifest payload is invalid')
  }

  return storePwaManifest(manifest, manifestUrl)
}

export async function createAndStorePwaManifest(overrides = {}) {
  const manifest = createManifestPayloadFromOverrides(overrides)

  if (!manifest) {
    throw new Error('PWA manifest overrides are invalid')
  }

  return storePwaManifest(manifest, '')
}

async function storePwaManifest(manifest, configUrl) {
  const manifestHref = await cacheDynamicManifest(manifest)
  const manifestUrl = normalizeManifestUrl(configUrl)

  const manifestInfo = {
    schemaVersion: MANIFEST_INFO_SCHEMA_VERSION,
    configUrl: manifestUrl,
    manifestHref,
    manifest,
    fetchedAt: Date.now(),
  }

  if (manifestUrl) {
    storage.set(STORAGE_KEYS.pwaManifestUrl, manifestUrl)
  } else {
    storage.remove(STORAGE_KEYS.pwaManifestUrl)
  }

  if (manifestHref) {
    storage.set(STORAGE_KEYS.pwaManifestInfo, manifestInfo)
    applyPwaManifestInfo(manifestInfo)
  } else {
    storage.remove(STORAGE_KEYS.pwaManifestInfo)
  }

  return manifestInfo
}

async function cacheDynamicManifest(manifest) {
  if (typeof caches === 'undefined' || typeof Response === 'undefined') return ''

  try {
    if (!(await waitForActiveServiceWorker())) return ''

    const response = new Response(JSON.stringify(manifest), {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })

    const cache = await caches.open(MANIFEST_CACHE_NAME)
    await cache.put(DYNAMIC_MANIFEST_HREF, response)

    return DYNAMIC_MANIFEST_HREF
  } catch {
    return ''
  }
}
