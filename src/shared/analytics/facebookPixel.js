import { getFacebookAttribution } from '@/shared/analytics/facebookAttribution'

const FACEBOOK_PIXEL_SCRIPT_ID = 'facebook-pixel-script'
const FACEBOOK_PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js'
const INSTALL_MARK_PREFIX = 'facebook:pwa-install:v1'
const initializedPixelIds = new Set()
const launchPixelIds = new Set()

function hasBrowserRuntime() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function ensureFacebookPixelQueue() {
  if (!hasBrowserRuntime()) return null
  if (typeof window.fbq === 'function') return window.fbq

  const fbq = (...args) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args)
      return
    }

    fbq.queue.push(args)
  }

  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  window.fbq = fbq
  window._fbq = fbq

  return fbq
}

function loadFacebookPixelScript() {
  if (!hasBrowserRuntime() || document.getElementById(FACEBOOK_PIXEL_SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = FACEBOOK_PIXEL_SCRIPT_ID
  script.async = true
  script.src = FACEBOOK_PIXEL_SCRIPT_SRC
  document.head.appendChild(script)
}

function normalizePixels(value) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  return value.filter((item) => {
    const pixelId = String(item?.pixelId || item?.pixel_id || '').trim()
    if (!pixelId || seen.has(pixelId)) return false
    seen.add(pixelId)
    return true
  })
}

function hasFacebookAdvertisingAttribution() {
  const attribution = getFacebookAttribution()
  return Boolean(attribution.fbclid || attribution.fbc)
}

function getInstallMark(pixelId, surface) {
  return `${INSTALL_MARK_PREFIX}:${surface}:${pixelId}`
}

function hasInstallMark(pixelId, surface) {
  try {
    return localStorage.getItem(getInstallMark(pixelId, surface)) === '1'
  } catch {
    return false
  }
}

function writeInstallMark(pixelId, surface) {
  try {
    localStorage.setItem(getInstallMark(pixelId, surface), '1')
  } catch {
    // The in-memory Pixel queue still records the event in restricted storage modes.
  }
}

export function initializeFacebookPixels(pixels) {
  if (!hasFacebookAdvertisingAttribution()) return []

  const normalizedPixels = normalizePixels(pixels)
  if (!normalizedPixels.length) return []

  const fbq = ensureFacebookPixelQueue()
  if (!fbq) return []

  loadFacebookPixelScript()

  normalizedPixels.forEach((pixel) => {
    const pixelId = String(pixel.pixelId || pixel.pixel_id).trim()

    if (!initializedPixelIds.has(pixelId)) {
      fbq('init', pixelId)
      initializedPixelIds.add(pixelId)
    }
  })

  return normalizedPixels
}

export function reportFacebookPwaInstall(pixels, parameters = {}) {
  const initializedPixels = initializeFacebookPixels(pixels)
  const surface = String(parameters.install_surface || 'shell')
  const fbq = ensureFacebookPixelQueue()
  if (!fbq) return false

  initializedPixels.forEach((pixel) => {
    const pixelId = String(pixel.pixelId || pixel.pixel_id).trim()
    if (hasInstallMark(pixelId, surface)) return

    fbq('trackSingleCustom', pixelId, 'PWAInstall', parameters)
    writeInstallMark(pixelId, surface)
  })

  return initializedPixels.length > 0
}

export function reportFacebookPwaLaunch(pixels, parameters = {}) {
  const initializedPixels = initializeFacebookPixels(pixels)
  const fbq = ensureFacebookPixelQueue()
  if (!fbq) return false

  initializedPixels.forEach((pixel) => {
    const pixelId = String(pixel.pixelId || pixel.pixel_id).trim()
    if (launchPixelIds.has(pixelId)) return

    fbq('trackSingleCustom', pixelId, 'PWALaunch', parameters)
    launchPixelIds.add(pixelId)
  })

  return initializedPixels.length > 0
}
