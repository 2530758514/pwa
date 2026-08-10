export const FRONTEND_ORIGIN_HEADER = 'X-Origin'

export function getFrontendOrigin() {
  if (typeof window === 'undefined') return ''

  return window.location?.origin || ''
}

export function appendFrontendOriginHeader(headers = {}) {
  if (headers[FRONTEND_ORIGIN_HEADER]) return headers

  const origin = getFrontendOrigin()

  if (!origin) return headers

  headers[FRONTEND_ORIGIN_HEADER] = origin

  return headers
}

export function shouldPreserveFrontendOriginHeader(config = {}) {
  if (String(config.method || '').toLowerCase() !== 'get') return false

  try {
    const proxyOrigin = 'https://pwa.invalid'
    const url = new URL(String(config.url || ''), proxyOrigin)
    return url.origin === proxyOrigin && url.pathname === '/pwa_h5_detail'
  } catch {
    return false
  }
}
