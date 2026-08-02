export const PLAYER_IDENTITY_HANDOFF_REQUEST = 'player_identity_handoff_request'
export const PLAYER_IDENTITY_HANDOFF_RESPONSE = 'player_identity_handoff_response'
export const PLAYER_IDENTITY_HANDOFF_ERROR = 'player_identity_handoff_error'
export const PLAYER_IDENTITY_MESSAGE_VERSION = 2

const REQUEST_FIELDS = new Set([
  'type',
  'version',
  'request_id',
  'target_client_id',
  'target_origin',
  'state',
  'code_challenge',
  'code_challenge_method',
])
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{22,128}$/
const CLIENT_ID_PATTERN = /^auto_h5_[a-f0-9]{64}$/
const STATE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/

function normalizeExactOrigin(value) {
  const candidate = String(value || '')
  try {
    return new URL(candidate).origin === candidate ? candidate : ''
  } catch {
    return ''
  }
}

export function parsePlayerIdentityHandoffRequest(data) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).some((name) => !REQUEST_FIELDS.has(name)) ||
    Object.keys(data).length !== REQUEST_FIELDS.size ||
    data.type !== PLAYER_IDENTITY_HANDOFF_REQUEST ||
    data.version !== PLAYER_IDENTITY_MESSAGE_VERSION ||
    !REQUEST_ID_PATTERN.test(data.request_id || '') ||
    !CLIENT_ID_PATTERN.test(data.target_client_id || '') ||
    !normalizeExactOrigin(data.target_origin) ||
    !STATE_PATTERN.test(data.state || '') ||
    !CHALLENGE_PATTERN.test(data.code_challenge || '') ||
    data.code_challenge_method !== 'S256'
  ) {
    return null
  }

  return Object.freeze({
    requestId: data.request_id,
    targetClientId: data.target_client_id,
    targetOrigin: data.target_origin,
    state: data.state,
    challenge: data.code_challenge,
  })
}

export function createPlayerIdentityHandoffResponse(result) {
  return Object.freeze({
    type: PLAYER_IDENTITY_HANDOFF_RESPONSE,
    version: PLAYER_IDENTITY_MESSAGE_VERSION,
    request_id: result.requestId,
    target_client_id: result.targetClientId,
    target_origin: result.targetOrigin,
    handoff_action: result.action,
    handoff_grant: result.grant,
    state: result.state,
  })
}

export function createPlayerIdentityHandoffError(request) {
  return Object.freeze({
    type: PLAYER_IDENTITY_HANDOFF_ERROR,
    version: PLAYER_IDENTITY_MESSAGE_VERSION,
    request_id: request.requestId,
    state: request.state,
    error: 'handoff_unavailable',
  })
}
