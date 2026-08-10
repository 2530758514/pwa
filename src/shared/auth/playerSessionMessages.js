export const PLAYER_SESSION_MESSAGE_VERSION = 1
export const PLAYER_SESSION_REQUEST = 'PLAYER_SESSION_REQUEST'
export const PLAYER_SESSION_READY = 'PLAYER_SESSION_READY'
export const PLAYER_SESSION_LOCKED = 'PLAYER_SESSION_LOCKED'
export const PLAYER_SESSION_UNAVAILABLE = 'PLAYER_SESSION_UNAVAILABLE'

const RESPONSE_TYPES = new Set([
  PLAYER_SESSION_READY,
  PLAYER_SESSION_LOCKED,
  PLAYER_SESSION_UNAVAILABLE,
])
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{24,64}$/
const STATE_PATTERN = /^[A-Za-z0-9_-]{22,128}$/
const REQUEST_KEYS = new Set(['type', 'version', 'request_id'])
const READY_NOTIFICATION_KEYS = new Set(['type', 'version', 'state'])

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

export function randomBase64url(byteLength = 24) {
  const bytes = new Uint8Array(byteLength)
  globalThis.crypto.getRandomValues(bytes)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function parsePlayerSessionRequest(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  if (!hasOnlyKeys(data, REQUEST_KEYS)) return null
  if (data.type !== PLAYER_SESSION_REQUEST || data.version !== PLAYER_SESSION_MESSAGE_VERSION) {
    return null
  }
  if (!REQUEST_ID_PATTERN.test(data.request_id || '')) return null

  return { type: data.type, requestId: data.request_id }
}

export function createPlayerSessionParentResponse(type, requestId, state) {
  if (!RESPONSE_TYPES.has(type)) return null
  if (!REQUEST_ID_PATTERN.test(requestId || '') || !STATE_PATTERN.test(state || '')) return null

  return {
    type,
    version: PLAYER_SESSION_MESSAGE_VERSION,
    request_id: requestId,
    state,
  }
}

export function parsePlayerSessionReadyNotification(data, expectedState) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  if (!hasOnlyKeys(data, READY_NOTIFICATION_KEYS)) return null
  if (data.type !== PLAYER_SESSION_READY || data.version !== PLAYER_SESSION_MESSAGE_VERSION) {
    return null
  }
  if (!STATE_PATTERN.test(data.state || '') || data.state !== expectedState) return null

  return { type: data.type, state: data.state }
}
