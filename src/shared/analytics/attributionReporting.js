export function getAttributionSafePageUrl() {
  if (typeof window === 'undefined') return ''

  return window.location.href
}
