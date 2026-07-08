export const OS_HEADER_NAME = 'X-Os'
export const OS_HEADER_WEB = 'web'
export const OS_HEADER_PWA_APP = 'pwa_app'

export function isPwaAppOpen() {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator?.standalone === true
  )
}

function hasHeader(headers, name) {
  if (!headers) return false

  if (typeof headers.has === 'function') {
    try {
      if (headers.has(name)) return true
    } catch {
      return false
    }
  }

  const normalizedName = name.toLowerCase()
  return Object.keys(headers).some((key) => key.toLowerCase() === normalizedName)
}

function setHeader(headers, name, value) {
  if (headers && typeof headers.set === 'function') {
    headers.set(name, value)
    return headers
  }

  headers[name] = value
  return headers
}

export function resolveOsHeaderValue() {
  return isPwaAppOpen() ? OS_HEADER_PWA_APP : OS_HEADER_WEB
}

export function appendOsHeader(headers = {}) {
  if (hasHeader(headers, OS_HEADER_NAME)) return headers

  return setHeader(headers, OS_HEADER_NAME, resolveOsHeaderValue())
}
