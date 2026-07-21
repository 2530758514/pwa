import { STORAGE_KEYS } from '@/shared/storage/keys'
import { storage } from '@/shared/storage/storage'

export const DEFAULT_MANIFEST_HREF = '/manifest.webmanifest'
export const DYNAMIC_MANIFEST_HREF = '/pwa-dynamic-manifest.webmanifest'
export const PWA_MANIFEST_HREF_CHANGE_EVENT = 'pwa:manifesthrefchange'
export const PWA_MANIFEST_SOURCE = String(import.meta.env.VITE_PWA_MANIFEST_SOURCE || 'dynamic')
  .trim()
  .toLowerCase()
const PWA_MANIFEST_CROSSORIGIN = String(import.meta.env.VITE_PWA_MANIFEST_CROSSORIGIN || 'anonymous')
  .trim()
  .toLowerCase()

const MANIFEST_CACHE_NAME = 'pwa-shell-manifest-v2'
const MANIFEST_INFO_SCHEMA_VERSION = 7
const MANIFEST_VERSION_PARAM = '_pwa_manifest_v'
const SCREENSHOT_DIMENSION_TIMEOUT_MS = 4000
const DEFAULT_INSTALL_DESCRIPTION =
  'Welcome to our entertainment platform, designed to bring you a smooth, exciting, and enjoyable experience anytime, anywhere.'
const DEFAULT_INSTALL_SCREENSHOTS = [
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
]
const DEFAULT_ICON_192 = '/pwa-icons/icon-192.png'
const DEFAULT_ICON_512 = '/pwa-icons/icon-512.png'
const DEFAULT_INSTALL_ICONS = [
  {
    src: DEFAULT_ICON_192,
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any maskable',
  },
  {
    src: DEFAULT_ICON_512,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  },
]
const PWA_APP_ID_PATH = '/'
const PWA_APP_SCOPE_PATH = '/'
const PWA_APP_START_PATH = '/'
export const PWA_PROTOCOL = 'web+hslot'
export const PWA_PROTOCOL_HANDLER_URL = '/?protocol_url=%s'
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
          : normalizeManifestUrl(item?.src || item?.url || item?.image || item?.image_url || item?.imageUrl)

      if (!src) return null

      const type = item?.type || inferImageMimeType(src)
      const sizes = normalizeTextValue(item?.sizes || item?.size)
      const label = normalizeTextValue(item?.label || item?.title)

      return {
        src,
        ...(sizes ? { sizes } : {}),
        ...(type ? { type } : {}),
        form_factor: item?.form_factor || item?.formFactor || 'narrow',
        ...(label ? { label } : {}),
      }
    })
    .filter(Boolean)
}

function parseScreenshotSizes(value) {
  const matched = String(value || '').match(/^(\d+)x(\d+)$/i)
  if (!matched) return null

  const width = Number(matched[1])
  const height = Number(matched[2])

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return { width, height }
}

function isRicherInstallScreenshotSize({ width, height } = {}) {
  if (!width || !height) return false

  const minimumDimension = Math.min(width, height)
  const maximumDimension = Math.max(width, height)

  return minimumDimension >= 320 && maximumDimension <= 3840 && maximumDimension / minimumDimension <= 2.3
}

function isRicherInstallScreenshotType(type) {
  const normalizedType = String(type || '').trim().toLowerCase()

  return !normalizedType || normalizedType === 'image/jpeg' || normalizedType === 'image/png'
}

function getGreatestCommonDivisor(left, right) {
  let first = Math.abs(Math.round(left))
  let second = Math.abs(Math.round(right))

  while (second) {
    const remainder = first % second
    first = second
    second = remainder
  }

  return first || 1
}

function getScreenshotAspectRatioKey({ width, height }) {
  const divisor = getGreatestCommonDivisor(width, height)

  return `${Math.round(width) / divisor}:${Math.round(height) / divisor}`
}

function loadScreenshotDimensions(src) {
  if (!src || typeof globalThis.Image !== 'function') return Promise.resolve(null)

  return new Promise((resolve) => {
    const image = new globalThis.Image()
    let settled = false
    let timer = null

    const finish = (dimensions = null) => {
      if (settled) return

      settled = true
      if (timer) globalThis.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(dimensions)
    }

    image.onload = () => {
      finish({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.onerror = () => finish()
    timer = globalThis.setTimeout(() => finish(), SCREENSHOT_DIMENSION_TIMEOUT_MS)
    image.src = src
  })
}

async function prepareRicherInstallScreenshots(screenshots = []) {
  const normalizedScreenshots = normalizeManifestScreenshots(screenshots).slice(0, 8)
  const candidates = (
    await Promise.all(
      normalizedScreenshots.map(async (screenshot) => {
        const dimensions =
          parseScreenshotSizes(screenshot.sizes) || (await loadScreenshotDimensions(screenshot.src))

        if (!isRicherInstallScreenshotSize(dimensions)) return null

        const type = screenshot.type || inferImageMimeType(screenshot.src)
        if (!isRicherInstallScreenshotType(type)) return null

        return {
          screenshot: {
            ...screenshot,
            sizes: `${dimensions.width}x${dimensions.height}`,
            ...(type ? { type } : {}),
            form_factor: 'narrow',
          },
          aspectRatio: getScreenshotAspectRatioKey(dimensions),
        }
      }),
    )
  ).filter(Boolean)

  const groups = new Map()

  candidates.forEach((candidate) => {
    const group = groups.get(candidate.aspectRatio) || []
    group.push(candidate.screenshot)
    groups.set(candidate.aspectRatio, group)
  })

  const preparedScreenshots = [...groups.values()].sort((left, right) => right.length - left.length)[0] || []

  if (preparedScreenshots.length) return preparedScreenshots

  return DEFAULT_INSTALL_SCREENSHOTS.map((screenshot) => ({ ...screenshot }))
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

function createManifestVersionValue(version = Date.now()) {
  const normalizedVersion = Number(version)

  return Number.isFinite(normalizedVersion) && normalizedVersion > 0
    ? String(Math.floor(normalizedVersion))
    : String(Date.now())
}

function getDefaultManifestUrl() {
  const origin = getCurrentOrigin()

  if (!origin) return DEFAULT_MANIFEST_HREF

  try {
    return new URL(DEFAULT_MANIFEST_HREF, origin).href
  } catch {
    return DEFAULT_MANIFEST_HREF
  }
}

function createVersionedManifestHref(manifestHref, version = Date.now()) {
  const normalizedHref = normalizeManifestUrl(manifestHref)

  if (!normalizedHref) return ''

  try {
    const url = new URL(normalizedHref, getCurrentOrigin() || 'https://localhost/')
    url.searchParams.set(MANIFEST_VERSION_PARAM, createManifestVersionValue(version))

    return url.href
  } catch {
    const separator = normalizedHref.includes('?') ? '&' : '?'

    return `${normalizedHref}${separator}${MANIFEST_VERSION_PARAM}=${encodeURIComponent(
      createManifestVersionValue(version),
    )}`
  }
}

function resolveAppManifestUrl(manifestHref) {
  const origin = getCurrentOrigin()

  if (!origin) return manifestHref

  try {
    return new URL(manifestHref, origin).href
  } catch {
    return manifestHref
  }
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

function isSameManifestPath(value, targetPath) {
  const source = String(value || '').trim()

  if (!source) return false
  if (source === targetPath) return true

  try {
    return new URL(source, getCurrentOrigin() || 'https://localhost/').pathname === targetPath
  } catch {
    return false
  }
}

function ensureInstallIcons(icons = []) {
  const nextIcons = Array.isArray(icons) ? icons.filter((icon) => icon?.src) : []
  const hasRemoteInstallIcon = nextIcons.some((icon) => {
    return !DEFAULT_INSTALL_ICONS.some((defaultIcon) => isSameManifestPath(icon.src, defaultIcon.src))
  })

  if (hasRemoteInstallIcon) {
    return nextIcons
  }

  DEFAULT_INSTALL_ICONS.forEach((defaultIcon) => {
    if (!nextIcons.some((icon) => isSameManifestPath(icon.src, defaultIcon.src))) {
      nextIcons.push({ ...defaultIcon })
    }
  })

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

function normalizeRelatedApplications(relatedApplications = [], manifestUrl = '') {
  const applications = Array.isArray(relatedApplications)
    ? relatedApplications
        .map((application) => {
          if (!application || typeof application !== 'object') return null

          const platform = normalizeTextValue(application.platform)
          const url = normalizeManifestUrl(resolveAbsoluteUrl(application.url, manifestUrl))

          if (!platform || !url) return null

          return {
            ...application,
            platform,
            url,
          }
        })
        .filter(Boolean)
    : []
  const webAppUrls = [manifestUrl, getDefaultManifestUrl(), resolveAppManifestUrl(DYNAMIC_MANIFEST_HREF)]

  webAppUrls.forEach((webAppUrl) => {
    const normalizedWebAppUrl = normalizeManifestUrl(webAppUrl)

    if (
      normalizedWebAppUrl &&
      !applications.some((application) => {
        return application.platform === 'webapp' && application.url === normalizedWebAppUrl
      })
    ) {
      applications.push({
        platform: 'webapp',
        url: normalizedWebAppUrl,
      })
    }
  })

  return applications
}

function normalizeInstallableManifest(manifest) {
  const name = resolveManifestName(manifest)
  const shortName = String(manifest.short_name || manifest.shortName || name).trim()
  const startUrl = resolveManifestAppUrl(PWA_APP_START_URL || PWA_APP_START_PATH, PWA_APP_START_PATH)
  const scope = resolveManifestAppUrl(PWA_APP_SCOPE_URL || PWA_APP_SCOPE_PATH, PWA_APP_SCOPE_PATH)
  const id = resolveManifestAppUrl(manifest.id || PWA_APP_ID_URL || PWA_APP_ID_PATH, PWA_APP_ID_PATH)
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
    related_applications: manifest.related_applications || [],
    icons: ensureInstallIcons(manifest.icons),
    ...(protocolHandlers.length ? { protocol_handlers: protocolHandlers } : {}),
    ...(launchHandler ? { launch_handler: launchHandler } : {}),
  }
}

function normalizeManifestPayload(manifest, manifestUrl, overrides = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null

  const normalizedOverrides = normalizeManifestOverrides(overrides)
  const nextManifest = {
    ...manifest,
    ...normalizedOverrides,
  }

  if (Array.isArray(normalizedOverrides.icons)) {
    nextManifest.icons = normalizedOverrides.icons
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

  nextManifest.related_applications = normalizeRelatedApplications(
    nextManifest.related_applications,
    manifestUrl,
  )

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

  const currentHref = link.getAttribute('href') || ''

  if (currentHref !== manifestHref) {
    link.setAttribute('href', manifestHref)
  }

  const crossOrigin = resolveManifestCrossOrigin(manifestHref)

  if (crossOrigin) {
    link.setAttribute('crossorigin', crossOrigin)
  } else {
    link.removeAttribute('crossorigin')
  }

  if (currentHref !== manifestHref && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PWA_MANIFEST_HREF_CHANGE_EVENT, {
        detail: {
          manifestHref,
        },
      }),
    )
  }

  return manifestHref
}

function createDynamicManifestHref(version = Date.now()) {
  const normalizedVersion = Number(version)
  const safeVersion = Number.isFinite(normalizedVersion) && normalizedVersion > 0 ? normalizedVersion : Date.now()

  return `${DYNAMIC_MANIFEST_HREF}?v=${safeVersion}`
}

function isDynamicManifestHref(manifestHref) {
  if (!manifestHref) return false

  try {
    const manifestUrl = new URL(manifestHref, getCurrentOrigin() || 'https://localhost/')
    return manifestUrl.pathname === DYNAMIC_MANIFEST_HREF
  } catch {
    return false
  }
}

function canServeDynamicManifest() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false

  return Boolean(navigator.serviceWorker.controller)
}

function createManifestPayloadFromOverrides(overrides = {}) {
  return normalizeManifestPayload({}, getDefaultManifestUrl(), overrides)
}

function timeout(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve(null), ms)
  })
}

function waitForServiceWorkerController(waitMs = SERVICE_WORKER_READY_WAIT_MS) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(false)
  if (navigator.serviceWorker.controller) return Promise.resolve(true)

  return new Promise((resolve) => {
    let timer = null

    const cleanup = (controlled) => {
      if (timer) globalThis.clearTimeout(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      resolve(controlled)
    }

    const handleControllerChange = () => {
      cleanup(Boolean(navigator.serviceWorker.controller))
    }

    timer = globalThis.setTimeout(() => cleanup(Boolean(navigator.serviceWorker.controller)), waitMs)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
  })
}

async function waitForActiveServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false

  if (navigator.serviceWorker.controller) return true

  const currentRegistration = await navigator.serviceWorker.getRegistration('/')
  if (currentRegistration?.active) return waitForServiceWorkerController()

  const readyRegistration = await Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    timeout(SERVICE_WORKER_READY_WAIT_MS),
  ])

  if (!readyRegistration?.active && !navigator.serviceWorker.controller) return false

  return waitForServiceWorkerController()
}

async function clearDynamicManifestCache() {
  if (typeof caches === 'undefined') return false

  try {
    const cache = await caches.open(MANIFEST_CACHE_NAME)
    return await cache.delete(DYNAMIC_MANIFEST_HREF)
  } catch {
    return false
  }
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

export function getCurrentPwaManifestHref() {
  const link = resolveManifestLink()

  if (!link) return ''

  return normalizeManifestUrl(link.getAttribute('href') || '')
}

export function isDefaultPwaManifestHref(manifestHref) {
  const normalizedHref = normalizeManifestUrl(manifestHref)

  if (!normalizedHref) return false

  try {
    return new URL(normalizedHref, getCurrentOrigin() || 'https://localhost/').pathname === DEFAULT_MANIFEST_HREF
  } catch {
    return normalizedHref === DEFAULT_MANIFEST_HREF
  }
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
  if (isDynamicManifestHref(manifestHref) && !canServeDynamicManifest()) {
    const fallbackManifestHref = createVersionedManifestHref(info.configUrl, info.fetchedAt)

    return applyManifestLinkHref(link, fallbackManifestHref || DEFAULT_MANIFEST_HREF)
  }

  return applyManifestLinkHref(link, manifestHref)
}

export function clearStoredPwaManifest(options = {}) {
  storage.remove(STORAGE_KEYS.pwaManifestUrl)
  storage.remove(STORAGE_KEYS.pwaManifestInfo)

  if (options.clearCache !== false) {
    void clearDynamicManifestCache()
  }
}

export async function clearStoredPwaManifestData() {
  clearStoredPwaManifest({ clearCache: false })
  await clearDynamicManifestCache()
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
    if (typeof document !== 'undefined' && document.title !== name) {
      document.title = name
    }

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
    const favicon = ensureHeadMeta('link[rel="icon"]', () => {
      const element = document.createElement('link')
      element.setAttribute('rel', 'icon')
      return element
    })
    const iconType = inferImageMimeType(icon)

    appleIcon?.setAttribute('href', icon)
    favicon?.setAttribute('href', icon)
    favicon?.setAttribute('sizes', 'any')

    if (iconType) {
      favicon?.setAttribute('type', iconType)
    } else {
      favicon?.removeAttribute('type')
    }
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

  const fetchedAt = Date.now()
  const manifestRequest = await fetchPwaManifestResponse(manifestUrl, fetchedAt)

  const manifest = normalizeManifestPayload(
    await manifestRequest.response.json(),
    manifestRequest.manifestHref,
    options.manifestOverrides,
  )

  if (!manifest) {
    throw new Error('PWA manifest payload is invalid')
  }

  return storePwaManifest(manifest, manifestUrl, { fetchedAt })
}

export async function createAndStorePwaManifest(overrides = {}) {
  const manifest = createManifestPayloadFromOverrides(overrides)

  if (!manifest) {
    throw new Error('PWA manifest overrides are invalid')
  }

  return storePwaManifest(manifest, '')
}

async function fetchPwaManifestResponse(manifestUrl, version = Date.now()) {
  const manifestHrefs = [
    createVersionedManifestHref(manifestUrl, version),
    normalizeManifestUrl(manifestUrl),
  ].filter((href, index, list) => href && list.indexOf(href) === index)
  let lastError = null

  for (const manifestHref of manifestHrefs) {
    try {
      const response = await fetch(manifestHref, {
        cache: 'no-store',
        credentials: PWA_MANIFEST_CROSSORIGIN === 'use-credentials' ? 'include' : 'same-origin',
      })

      if (response.ok) {
        return {
          manifestHref,
          response,
        }
      }

      lastError = new Error(`PWA manifest request failed: ${response.status}`)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('PWA manifest request failed')
}

async function storePwaManifest(manifest, configUrl, options = {}) {
  const fetchedAt = Number.isFinite(options.fetchedAt) && options.fetchedAt > 0 ? options.fetchedAt : Date.now()
  const manifestUrl = normalizeManifestUrl(configUrl)
  const richerInstallScreenshots = await prepareRicherInstallScreenshots(manifest.screenshots)
  const installManifest = {
    ...manifest,
    description: normalizeDescriptionValue(manifest.description) || DEFAULT_INSTALL_DESCRIPTION,
    screenshots: richerInstallScreenshots,
  }
  const dynamicManifestHref = await cacheDynamicManifest(installManifest, fetchedAt)
  const remoteManifestHref = createVersionedManifestHref(manifestUrl, fetchedAt) || manifestUrl
  const manifestHref = dynamicManifestHref || remoteManifestHref

  const manifestInfo = {
    schemaVersion: MANIFEST_INFO_SCHEMA_VERSION,
    configUrl: manifestUrl,
    manifestHref,
    manifest: installManifest,
    fetchedAt,
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
    applyPwaManifestUrl(DEFAULT_MANIFEST_HREF)
  }

  return manifestInfo
}

async function cacheDynamicManifest(manifest, version = Date.now()) {
  if (
    typeof caches === 'undefined' ||
    typeof Response === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return ''
  }

  try {
    const response = new Response(JSON.stringify(manifest), {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })

    const cache = await caches.open(MANIFEST_CACHE_NAME)
    await cache.put(DYNAMIC_MANIFEST_HREF, response)

    return (await waitForActiveServiceWorker()) ? createDynamicManifestHref(version) : ''
  } catch {
    return ''
  }
}
