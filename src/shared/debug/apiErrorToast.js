const TOAST_CONTAINER_ID = 'api-debug-error-toast-container'
const TOAST_DURATION_MS = 8000
const DUPLICATE_WINDOW_MS = 1200
const MAX_VISIBLE_TOASTS = 4
const MAX_MESSAGE_LENGTH = 240

let lastToastKey = ''
let lastToastAt = 0

function readRuntimeEnv() {
  return import.meta.env || {}
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function truncate(value, maxLength = MAX_MESSAGE_LENGTH) {
  const text = normalizeText(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function resolveRequestPath(error = {}) {
  const config = error.config || error.response?.config || {}
  const rawUrl = normalizeText(error.requestUrl || config.url)
  if (!rawUrl) return 'unknown endpoint'

  try {
    const baseUrl =
      normalizeText(config.baseURL) || globalThis.location?.origin || 'https://debug.invalid'
    return new URL(rawUrl, baseUrl).pathname || '/'
  } catch {
    return rawUrl.split(/[?#]/, 1)[0] || 'unknown endpoint'
  }
}

function resolveStatusLine(error = {}) {
  const httpStatus = error.httpStatus ?? error.response?.status
  const apiCode = error.apiCode ?? error.response?.data?.code
  const values = []

  if (httpStatus !== null && httpStatus !== undefined && httpStatus !== '') {
    values.push(`HTTP ${httpStatus}`)
  }
  if (apiCode !== null && apiCode !== undefined && apiCode !== '') {
    values.push(`API ${apiCode}`)
  }
  if (!values.length && error.code) values.push(normalizeText(error.code))

  return values.join(' · ')
}

function ensureToastContainer(documentObject) {
  let container = documentObject.getElementById(TOAST_CONTAINER_ID)
  if (container) return container

  container = documentObject.createElement('div')
  container.id = TOAST_CONTAINER_ID
  Object.assign(container.style, {
    position: 'fixed',
    zIndex: '2147483647',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    left: '50%',
    display: 'grid',
    width: 'min(92vw, 520px)',
    gap: '8px',
    pointerEvents: 'none',
    transform: 'translateX(-50%)',
  })
  documentObject.documentElement.appendChild(container)

  return container
}

export function isDebugApiErrorToastEnabled(env = readRuntimeEnv()) {
  if (normalizeText(env.MODE).toLowerCase() === 'production') return false

  return env.DEV === true || normalizeText(env.VITE_ENABLE_API_ERROR_TOAST).toLowerCase() === 'true'
}

export function formatDebugApiError(error = {}) {
  const config = error.config || error.response?.config || {}
  const method = normalizeText(error.requestMethod || config.method || 'REQUEST').toUpperCase()
  const endpoint = resolveRequestPath(error)
  const statusLine = resolveStatusLine(error)
  const message = truncate(
    error.message || error.response?.data?.msg || error.response?.data?.message || 'Request failed',
  )

  return [`[API] ${method} ${endpoint}`, statusLine, message].filter(Boolean).join('\n')
}

export function showDebugApiErrorToast(error, options = {}) {
  if (!isDebugApiErrorToastEnabled(options.env)) return false
  if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return false

  const documentObject = options.documentObject || globalThis.document
  if (!documentObject?.documentElement || typeof documentObject.createElement !== 'function') {
    return false
  }

  const text = formatDebugApiError(error)
  const now = Date.now()
  if (text === lastToastKey && now - lastToastAt < DUPLICATE_WINDOW_MS) return false

  lastToastKey = text
  lastToastAt = now

  const container = ensureToastContainer(documentObject)
  while (container.children.length >= MAX_VISIBLE_TOASTS) {
    container.firstElementChild?.remove()
  }

  const toast = documentObject.createElement('div')
  toast.setAttribute('role', 'alert')
  toast.textContent = text
  Object.assign(toast.style, {
    boxSizing: 'border-box',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid rgba(255, 125, 125, 0.78)',
    borderRadius: '8px',
    color: '#ffffff',
    background: 'rgba(132, 24, 24, 0.96)',
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.38)',
    font: '500 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-line',
  })
  container.appendChild(toast)

  const remove = () => {
    toast.remove()
    if (!container.children.length) container.remove()
  }
  globalThis.setTimeout?.(remove, options.durationMs || TOAST_DURATION_MS)

  return true
}
