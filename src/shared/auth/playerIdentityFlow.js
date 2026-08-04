export const PWA_IDENTITY_HANDOFF_FLOW_KEY = 'pwa_player_identity_handoff_flow_v2'
export const PWA_IDENTITY_HANDOFF_FLOW_MAX_AGE_MS = 5 * 60 * 1000
export const PWA_IDENTITY_INSTALL_FLOW_KEY = 'pwa_player_identity_install_flow_v1'
export const PWA_IDENTITY_INSTALL_PENDING_KEY = 'pwa_player_identity_install_pending_v1'
export const PWA_IDENTITY_INSTALL_COMPLETED_KEY = 'pwa_player_identity_install_completed_v1'
export const PWA_IDENTITY_INSTALL_MAX_AGE_MS = 24 * 60 * 60 * 1000

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

function getLocalStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function normalizeExactOrigin(value) {
  const origin = String(value || '')

  try {
    return new URL(origin).origin === origin ? origin : ''
  } catch {
    return ''
  }
}

function readStoredJson(storage, key) {
  try {
    const value = storage?.getItem(key)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function writeStoredJson(storage, key, value, errorCode) {
  const serialized = JSON.stringify(value)

  try {
    storage?.setItem(key, serialized)
    if (storage?.getItem(key) !== serialized) throw new Error(errorCode)
  } catch (error) {
    if (error?.message === errorCode) throw error
    throw new Error(errorCode, { cause: error })
  }
}

function removeStoredValue(storage, key) {
  try {
    storage?.removeItem(key)
  } catch {
    // Missing cleanup cannot make an invalid record pass strict validation.
  }
}

export function randomBase64url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength)
  globalThis.crypto.getRandomValues(bytes)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function createPkceChallenge(verifier) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(verifier || '')),
  )
  let binary = ''

  new Uint8Array(digest).forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
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

export function readInstallHandoffFlow() {
  return readStoredJson(getLocalStorage(), PWA_IDENTITY_INSTALL_FLOW_KEY)
}

export function writeInstallHandoffFlow(flow) {
  writeStoredJson(
    getLocalStorage(),
    PWA_IDENTITY_INSTALL_FLOW_KEY,
    flow,
    'identity_local_storage_unavailable',
  )
}

export function clearInstallHandoffFlow() {
  removeStoredValue(getLocalStorage(), PWA_IDENTITY_INSTALL_FLOW_KEY)
}

export function isValidInstallHandoffFlow(flow, now = Date.now()) {
  return Boolean(
    flow &&
      typeof flow === 'object' &&
      !Array.isArray(flow) &&
      flow.version === 1 &&
      flow.type === 'install' &&
      /^[A-Za-z0-9_-]{22,128}$/.test(flow.handoffId || '') &&
      CLIENT_ID_PATTERN.test(flow.sourceClientId || '') &&
      CLIENT_ID_PATTERN.test(flow.targetClientId || '') &&
      normalizeExactOrigin(flow.targetOrigin) === flow.targetOrigin &&
      STATE_PATTERN.test(flow.state || '') &&
      STATE_PATTERN.test(flow.verifier || '') &&
      /^[A-Za-z0-9_-]{43}$/.test(flow.challenge || '') &&
      Number.isFinite(Number(flow.startedAt)) &&
      now - Number(flow.startedAt) >= 0 &&
      now - Number(flow.startedAt) <= PWA_IDENTITY_INSTALL_MAX_AGE_MS,
  )
}

export function readPendingInstallHandoff() {
  return readStoredJson(getLocalStorage(), PWA_IDENTITY_INSTALL_PENDING_KEY)
}

export function writePendingInstallHandoff(handoff) {
  writeStoredJson(
    getLocalStorage(),
    PWA_IDENTITY_INSTALL_PENDING_KEY,
    handoff,
    'identity_local_storage_unavailable',
  )
}

export function clearPendingInstallHandoff() {
  removeStoredValue(getLocalStorage(), PWA_IDENTITY_INSTALL_PENDING_KEY)
}

export function isValidPendingInstallHandoff(handoff, now = Date.now()) {
  return Boolean(
    handoff &&
      typeof handoff === 'object' &&
      !Array.isArray(handoff) &&
      handoff.version === 1 &&
      handoff.type === 'install_pending' &&
      /^[A-Za-z0-9_-]{22,128}$/.test(handoff.handoffId || '') &&
      CLIENT_ID_PATTERN.test(handoff.sourceClientId || '') &&
      CLIENT_ID_PATTERN.test(handoff.targetClientId || '') &&
      normalizeExactOrigin(handoff.targetOrigin) === handoff.targetOrigin &&
      STATE_PATTERN.test(handoff.state || '') &&
      STATE_PATTERN.test(handoff.verifier || '') &&
      ['exchange', 'provision'].includes(handoff.action) &&
      CODE_PATTERN.test(handoff.grant || '') &&
      Number.isFinite(Number(handoff.createdAt)) &&
      now - Number(handoff.createdAt) >= 0 &&
      now - Number(handoff.createdAt) <= PWA_IDENTITY_INSTALL_MAX_AGE_MS,
  )
}

export function readCompletedInstallHandoff() {
  return readStoredJson(getLocalStorage(), PWA_IDENTITY_INSTALL_COMPLETED_KEY)
}

export function writeCompletedInstallHandoff(marker) {
  writeStoredJson(
    getLocalStorage(),
    PWA_IDENTITY_INSTALL_COMPLETED_KEY,
    marker,
    'identity_local_storage_unavailable',
  )
}

export function isCompletedInstallHandoffForTarget(marker, { targetClientId, targetOrigin }) {
  return Boolean(
    marker &&
      typeof marker === 'object' &&
      !Array.isArray(marker) &&
      marker.version === 1 &&
      marker.targetClientId === targetClientId &&
      marker.targetOrigin === targetOrigin &&
      CLIENT_ID_PATTERN.test(marker.targetClientId || '') &&
      normalizeExactOrigin(marker.targetOrigin) === marker.targetOrigin &&
      Number.isFinite(Number(marker.completedAt)),
  )
}
