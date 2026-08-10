export const PLAYER_SESSION_STATUS = Object.freeze({
  IDLE: 'idle',
  MIGRATION_REQUIRED: 'migration-required',
  BOOTSTRAPPING: 'bootstrapping',
  REGISTRATION_REQUIRED: 'registration-required',
  AUTHENTICATED: 'authenticated',
  RECOVERY_REQUIRED: 'recovery-required',
  LOCKED: 'locked',
  UNAVAILABLE: 'unavailable',
  FATAL_CONFIG: 'fatal-config',
  CONTRACT_ERROR: 'contract-error',
})

export const PLAYER_SESSION_RESULT = Object.freeze({
  AUTHENTICATED: 'authenticated',
  REGISTRATION_REQUIRED: 'registration-required',
  UNAUTHORIZED: 'unauthorized',
  FATAL_CONFIG: 'fatal-config',
  LOCKED: 'locked',
  UNAVAILABLE: 'unavailable',
  METHOD_ERROR: 'method-error',
  CONTRACT_ERROR: 'contract-error',
})

const BOOTSTRAP_RESPONSE_CODES = new Set([200, 401, 402, 403, 405, 423, 503])

function normalizeCode(value) {
  const code = Number(value)
  return Number.isInteger(code) ? code : null
}

export function classifyPlayerSessionBootstrapResponse(response = {}) {
  const status = normalizeCode(response.status)
  const apiCode = normalizeCode(response.body?.code)

  if (!BOOTSTRAP_RESPONSE_CODES.has(status) || status !== apiCode) {
    return PLAYER_SESSION_RESULT.CONTRACT_ERROR
  }

  if (status === 200) {
    const data = response.body?.data
    return data?.authenticated === true && data?.user_id != null
      ? PLAYER_SESSION_RESULT.AUTHENTICATED
      : PLAYER_SESSION_RESULT.CONTRACT_ERROR
  }

  if (status === 402) {
    return response.body?.data?.registration_required === true
      ? PLAYER_SESSION_RESULT.REGISTRATION_REQUIRED
      : PLAYER_SESSION_RESULT.CONTRACT_ERROR
  }

  if (status === 401) return PLAYER_SESSION_RESULT.UNAUTHORIZED
  if (status === 403) return PLAYER_SESSION_RESULT.FATAL_CONFIG
  if (status === 405) return PLAYER_SESSION_RESULT.METHOD_ERROR
  if (status === 423) return PLAYER_SESSION_RESULT.LOCKED
  if (status === 503) return PLAYER_SESSION_RESULT.UNAVAILABLE

  return PLAYER_SESSION_RESULT.CONTRACT_ERROR
}

export async function runPlayerSessionBootstrap({ request, legacyToken = '' } = {}) {
  if (typeof request !== 'function') {
    throw new TypeError('player_session_bootstrap_request_required')
  }

  const normalizedLegacyToken = String(legacyToken || '').trim()

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await request({
      attempt,
      legacyToken: normalizedLegacyToken,
    })
    const result = classifyPlayerSessionBootstrapResponse(response)

    if (result === PLAYER_SESSION_RESULT.UNAUTHORIZED && attempt === 1) continue

    return {
      attempts: attempt,
      legacyToken: normalizedLegacyToken,
      response,
      result,
    }
  }

  throw new Error('player_session_bootstrap_unreachable')
}

export function createSingleFlight() {
  let pendingPromise = null

  return function runSingleFlight(operation) {
    if (pendingPromise) return pendingPromise
    if (typeof operation !== 'function') {
      return Promise.reject(new TypeError('single_flight_operation_required'))
    }

    pendingPromise = Promise.resolve()
      .then(operation)
      .finally(() => {
        pendingPromise = null
      })

    return pendingPromise
  }
}
