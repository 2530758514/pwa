import { PLAYER_SESSION_STATUS } from '@/shared/auth/playerSessionFlow'
import {
  PLAYER_SESSION_LOCKED,
  PLAYER_SESSION_READY,
  PLAYER_SESSION_UNAVAILABLE,
  createPlayerSessionParentResponse,
  parsePlayerSessionReadyNotification,
  parsePlayerSessionRequest,
  randomBase64url,
} from '@/shared/auth/playerSessionMessages'

let activeIframeWindow = null
let activeIframeOrigin = ''
let activeState = ''

function normalizeExactOrigin(value) {
  const candidate = String(value || '')
  try {
    return new URL(candidate).origin === candidate ? candidate : ''
  } catch {
    return ''
  }
}

function resolveResponseType(status) {
  if (status === PLAYER_SESSION_STATUS.AUTHENTICATED) return PLAYER_SESSION_READY
  if (status === PLAYER_SESSION_STATUS.LOCKED) return PLAYER_SESSION_LOCKED
  return PLAYER_SESSION_UNAVAILABLE
}

function isTrustedIframeEvent(event, iframeWindow, iframeOrigin, allowedOrigins) {
  const normalizedOrigin = normalizeExactOrigin(iframeOrigin)
  const normalizedAllowlist = allowedOrigins.map(normalizeExactOrigin).filter(Boolean)

  return Boolean(
    iframeWindow &&
    normalizedOrigin &&
    normalizedAllowlist.includes(normalizedOrigin) &&
    event.source === iframeWindow &&
    event.origin === normalizedOrigin,
  )
}

export function handlePlayerSessionIframeMessage({
  event,
  iframeWindow,
  iframeOrigin,
  allowedOrigins = [],
  sessionStatus,
  onSessionReady,
} = {}) {
  if (!isTrustedIframeEvent(event, iframeWindow, iframeOrigin, allowedOrigins)) return false

  if (
    activeIframeWindow === iframeWindow &&
    activeIframeOrigin === iframeOrigin &&
    parsePlayerSessionReadyNotification(event.data, activeState)
  ) {
    if (typeof onSessionReady === 'function') onSessionReady()
    return true
  }

  const request = parsePlayerSessionRequest(event.data)
  if (!request) return false

  if (activeIframeWindow !== iframeWindow || activeIframeOrigin !== iframeOrigin || !activeState) {
    activeIframeWindow = iframeWindow
    activeIframeOrigin = iframeOrigin
    activeState = randomBase64url()
  }

  const response = createPlayerSessionParentResponse(
    resolveResponseType(sessionStatus),
    request.requestId,
    activeState,
  )
  if (!response) return true

  iframeWindow.postMessage(response, iframeOrigin)
  return true
}

export function resetPlayerSessionIframeBridge() {
  activeIframeWindow = null
  activeIframeOrigin = ''
  activeState = ''
}
