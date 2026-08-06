export const PLAYER_IDENTITY_HANDOFF_REQUEST = 'player_identity_handoff_request'
export const PLAYER_IDENTITY_HANDOFF_RESPONSE = 'player_identity_handoff_response'
export const PLAYER_IDENTITY_HANDOFF_ERROR = 'player_identity_handoff_error'
export const PLAYER_IDENTITY_HANDOFF_CONSUMED = 'player_identity_handoff_consumed'
export const PLAYER_IDENTITY_PARENT_READY = 'player_identity_parent_ready'
export const PLAYER_IDENTITY_MESSAGE_VERSION = 2
export const PLAYER_IDENTITY_INSTALL_RESPONSE_VERSION = 3
export const PLAYER_IDENTITY_CONSUMED_VERSION = 1
export const PLAYER_IDENTITY_PARENT_READY_VERSION = 1

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
const CONSUMED_FIELDS = new Set([
  'type',
  'version',
  'request_id',
  'handoff_id',
  'target_client_id',
  'target_origin',
])
const PARENT_READY_FIELDS = new Set(['type', 'version'])

export function createPlayerIdentityParentReady() {
  return Object.freeze({
    type: PLAYER_IDENTITY_PARENT_READY,
    version: PLAYER_IDENTITY_PARENT_READY_VERSION,
  })
}

export function isPlayerIdentityParentReady(data) {
  return Boolean(
    data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      Object.keys(data).length === PARENT_READY_FIELDS.size &&
      Object.keys(data).every((name) => PARENT_READY_FIELDS.has(name)) &&
      data.type === PLAYER_IDENTITY_PARENT_READY &&
      data.version === PLAYER_IDENTITY_PARENT_READY_VERSION,
  )
}

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
  if (result.mode === 'install') {
    return Object.freeze({
      type: PLAYER_IDENTITY_HANDOFF_RESPONSE,
      version: PLAYER_IDENTITY_INSTALL_RESPONSE_VERSION,
      request_id: result.requestId,
      handoff_id: result.handoffId,
      target_client_id: result.targetClientId,
      target_origin: result.targetOrigin,
      handoff_action: result.action,
      handoff_grant: result.grant,
      state: result.state,
      code_verifier: result.verifier,
    })
  }

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

export function parsePlayerIdentityHandoffConsumed(data) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).length !== CONSUMED_FIELDS.size ||
    Object.keys(data).some((name) => !CONSUMED_FIELDS.has(name)) ||
    data.type !== PLAYER_IDENTITY_HANDOFF_CONSUMED ||
    data.version !== PLAYER_IDENTITY_CONSUMED_VERSION ||
    !REQUEST_ID_PATTERN.test(data.request_id || '') ||
    !REQUEST_ID_PATTERN.test(data.handoff_id || '') ||
    !CLIENT_ID_PATTERN.test(data.target_client_id || '') ||
    !normalizeExactOrigin(data.target_origin)
  ) {
    return null
  }

  return Object.freeze({
    requestId: data.request_id,
    handoffId: data.handoff_id,
    targetClientId: data.target_client_id,
    targetOrigin: data.target_origin,
  })
}

export function createPlayerIdentityHandoffError(request, error = 'handoff_unavailable') {
  const safeError = ['handoff_unavailable', 'install_handoff_missing'].includes(error)
    ? error
    : 'handoff_unavailable'

  return Object.freeze({
    type: PLAYER_IDENTITY_HANDOFF_ERROR,
    version: PLAYER_IDENTITY_MESSAGE_VERSION,
    request_id: request.requestId,
    state: request.state,
    error: safeError,
  })
}
