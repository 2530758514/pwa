const BOOTSTRAP_LOADING_ID = 'identity-bootstrap-loading'
const LEAVING_CLASS = 'identity-first-paint--leaving'
const REMOVE_FALLBACK_MS = 240

export function dismissBootstrapLoading({
  documentObject = typeof document === 'undefined' ? null : document,
  windowObject = typeof window === 'undefined' ? null : window,
  immediate = false,
} = {}) {
  const element = documentObject?.getElementById?.(BOOTSTRAP_LOADING_ID)
  if (!element || element.dataset?.dismissed === 'true') return false

  element.dataset.dismissed = 'true'
  const reducedMotion = windowObject?.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  if (immediate || reducedMotion || !windowObject?.setTimeout) {
    element.remove()
    return true
  }

  let fallbackTimer = 0
  const remove = () => {
    if (fallbackTimer) windowObject.clearTimeout?.(fallbackTimer)
    element.removeEventListener?.('transitionend', remove)
    element.remove()
  }

  element.addEventListener?.('transitionend', remove, { once: true })
  element.classList?.add(LEAVING_CLASS)
  fallbackTimer = windowObject.setTimeout(remove, REMOVE_FALLBACK_MS)
  return true
}
