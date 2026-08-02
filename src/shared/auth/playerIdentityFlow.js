export const PWA_IDENTITY_HANDOFF_FLOW_KEY = 'pwa_player_identity_handoff_flow_v2'
export const PWA_IDENTITY_HANDOFF_FLOW_MAX_AGE_MS = 5 * 60 * 1000

const CALLBACK_FIELDS = new Set(['handoff_grant', 'handoff_action', 'error', 'state'])
const CLIENT_ID_PATTERN = /^auto_h5_[a-f0-9]{64}$/
const STATE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/
const CODE_PATTERN = /^[a-f0-9]{64}$/

function getSessionStorage() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export async function createAutomaticClientId(origin) {
  const clientOrigin = String(origin || '')

  try {
    if (new URL(clientOrigin).origin !== clientOrigin) {
      throw new Error('identity_client_origin_invalid')
    }
  } catch (error) {
    if (error?.message === 'identity_client_origin_invalid') throw error
    throw new Error('identity_client_origin_invalid', { cause: error })
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(clientOrigin),
  )
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

  return `auto_h5_${hex}`
}

export function parseHandoffCallbackFragment(fragment) {
  const result = Object.create(null)

  for (const [name, value] of new URLSearchParams(String(fragment || ''))) {
    if (!CALLBACK_FIELDS.has(name) || Object.prototype.hasOwnProperty.call(result, name)) {
      throw new Error('identity_handoff_callback_invalid')
    }
    result[name] = value
  }

  const hasGrant = Object.prototype.hasOwnProperty.call(result, 'handoff_grant')
  const hasError = Object.prototype.hasOwnProperty.call(result, 'error')
  const validGrant =
    hasGrant &&
    Object.keys(result).length === 3 &&
    CODE_PATTERN.test(result.handoff_grant || '') &&
    ['exchange', 'provision'].includes(result.handoff_action)
  const validError =
    hasError &&
    Object.keys(result).length === 2 &&
    result.error === 'identity_not_available'

  if (
    hasGrant === hasError ||
    !STATE_PATTERN.test(result.state || '') ||
    (!validGrant && !validError)
  ) {
    throw new Error('identity_handoff_callback_invalid')
  }

  return Object.freeze({ ...result })
}

export function takeHandoffCallbackFragment() {
  if (typeof window === 'undefined') return ''

  const fragment = String(window.__PWA_PLAYER_IDENTITY_HANDOFF_CALLBACK_FRAGMENT__ || '')
  delete window.__PWA_PLAYER_IDENTITY_HANDOFF_CALLBACK_FRAGMENT__
  delete window.__PWA_PLAYER_IDENTITY_CALLBACK_ACTIVE__
  return fragment
}

export function readHandoffFlow() {
  try {
    const value = getSessionStorage()?.getItem(PWA_IDENTITY_HANDOFF_FLOW_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function writeHandoffFlow(flow) {
  const session = getSessionStorage()
  const serialized = JSON.stringify(flow)

  try {
    session?.setItem(PWA_IDENTITY_HANDOFF_FLOW_KEY, serialized)
    if (session?.getItem(PWA_IDENTITY_HANDOFF_FLOW_KEY) !== serialized) {
      throw new Error('identity_session_storage_unavailable')
    }
  } catch (error) {
    if (error?.message === 'identity_session_storage_unavailable') throw error
    throw new Error('identity_session_storage_unavailable', { cause: error })
  }
}

export function clearHandoffFlow() {
  try {
    getSessionStorage()?.removeItem(PWA_IDENTITY_HANDOFF_FLOW_KEY)
  } catch {
    // Invalid flow data remains unusable even when storage cleanup is restricted.
  }
}

export function isValidHandoffFlow(flow, now = Date.now()) {
  if (!flow || typeof flow !== 'object' || Array.isArray(flow) || flow.version !== 2) return false

  let targetOrigin = ''
  try {
    targetOrigin = new URL(String(flow.targetOrigin || '')).origin
  } catch {
    return false
  }

  return Boolean(
    targetOrigin === flow.targetOrigin &&
      CLIENT_ID_PATTERN.test(flow.sourceClientId || '') &&
      CLIENT_ID_PATTERN.test(flow.targetClientId || '') &&
      /^[A-Za-z0-9_-]{22,128}$/.test(flow.requestId || '') &&
      STATE_PATTERN.test(flow.state || '') &&
      /^[A-Za-z0-9_-]{43}$/.test(flow.challenge || '') &&
      Number.isFinite(Number(flow.startedAt)) &&
      now - Number(flow.startedAt) >= 0 &&
      now - Number(flow.startedAt) <= PWA_IDENTITY_HANDOFF_FLOW_MAX_AGE_MS,
  )
}
