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
