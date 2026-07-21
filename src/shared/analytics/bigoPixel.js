import { getStoredBigoPixelId } from '@/shared/analytics/bigoAttribution'

const BIGO_PIXEL_HOST = 'tk.mowell.tech'
const BIGO_SCRIPT_HOST_ATTRIBUTE = 'data-pixel-script-dm'
const BIGO_SCRIPT_LOADED_ATTRIBUTE = 'data-bigo-pixel-loaded'
const BIGO_APP_DOWNLOAD_EVENT = 'app_download'

function hasBrowserRuntime() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function normalizeValue(value) {
  const normalized = String(value ?? '').trim()

  if (!normalized || normalized === 'null' || normalized === 'undefined') return ''

  return normalized
}

function ensureBigoQueue() {
  if (!hasBrowserRuntime()) return null

  if (!Array.isArray(window.bgdataLayer)) {
    window.bgdataLayer = []
  }

  if (typeof window.bge !== 'function') {
    window.bge = function bge() {
      window.bgdataLayer.push(arguments)
    }
  }

  return window.bge
}

class BigoPixelManager {
  constructor() {
    this.pixelId = ''
    this.isInitialized = false
    this.scriptLoaded = false
    this.scriptLoadFailed = false
  }

  findExistingScript(pixelId) {
    if (!hasBrowserRuntime()) return null

    return Array.from(document.querySelectorAll(`script[${BIGO_SCRIPT_HOST_ATTRIBUTE}]`)).find(
      (script) => {
        if (script.getAttribute(BIGO_SCRIPT_HOST_ATTRIBUTE) !== BIGO_PIXEL_HOST) return false

        try {
          return new URL(script.src).searchParams.get('pixel_id') === pixelId
        } catch {
          return false
        }
      },
    )
  }

  loadScript(pixelId) {
    const existingScript = this.findExistingScript(pixelId)

    if (existingScript) {
      this.scriptLoaded = existingScript.getAttribute(BIGO_SCRIPT_LOADED_ATTRIBUTE) === 'true'
      return existingScript
    }

    const script = document.createElement('script')
    script.src = `https://${BIGO_PIXEL_HOST}/ad/events.js?pixel_id=${encodeURIComponent(pixelId)}`
    script.async = true
    script.setAttribute(BIGO_SCRIPT_HOST_ATTRIBUTE, BIGO_PIXEL_HOST)
    script.addEventListener(
      'load',
      () => {
        this.scriptLoaded = true
        this.scriptLoadFailed = false
        script.setAttribute(BIGO_SCRIPT_LOADED_ATTRIBUTE, 'true')
      },
      { once: true },
    )
    script.addEventListener(
      'error',
      () => {
        this.scriptLoadFailed = true
      },
      { once: true },
    )
    ;(document.head || document.body || document.documentElement).appendChild(script)

    return script
  }

  init(options = {}) {
    if (!hasBrowserRuntime()) return false

    try {
      const pixelId = normalizeValue(options.pixelId)

      if (!pixelId) return false
      if (this.isInitialized && this.pixelId === pixelId) return true

      const bge = ensureBigoQueue()
      if (!bge) return false

      this.loadScript(pixelId)
      bge('init', pixelId)

      this.pixelId = pixelId
      this.isInitialized = true
      this.scriptLoadFailed = false

      return true
    } catch {
      this.scriptLoadFailed = true
      return false
    }
  }

  trackEvent(eventName, parameters = {}) {
    const normalizedEventName = normalizeValue(eventName)
    const pixelId = this.pixelId || getStoredBigoPixelId()

    if (!normalizedEventName || (!this.isInitialized && !this.init({ pixelId }))) return false

    const bge = ensureBigoQueue()
    if (!bge) return false

    try {
      bge('event', normalizedEventName, parameters)
      return true
    } catch {
      return false
    }
  }

  trackAppDownload(parameters = {}) {
    const pixelId = this.pixelId || getStoredBigoPixelId()

    if (!pixelId) return false

    return this.trackEvent(BIGO_APP_DOWNLOAD_EVENT, {
      ...parameters,
      configId: pixelId,
      monetary: Number(parameters.monetary ?? 0) || 0,
    })
  }
}

const bigoPixelManager = new BigoPixelManager()

export function notifyBigoAppDownload(parameters = {}) {
  return bigoPixelManager.trackAppDownload(parameters)
}

export default bigoPixelManager
export { BIGO_APP_DOWNLOAD_EVENT, BIGO_PIXEL_HOST, BigoPixelManager }
