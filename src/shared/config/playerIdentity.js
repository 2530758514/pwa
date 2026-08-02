const DEFAULT_CALLBACK_PATH = '/'

function normalizeBoolean(value) {
  return value === true || String(value || '').toLowerCase() === 'true'
}

function normalizeHttpsOrigin(value) {
  try {
    const url = new URL(String(value || '').trim())
    return url.protocol === 'https:' &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
      ? url.origin
      : ''
  } catch {
    return ''
  }
}

function normalizeCallbackPath(value) {
  const path = String(value || DEFAULT_CALLBACK_PATH).trim()

  if (!path.startsWith('/') || path.startsWith('//') || path.includes('?') || path.includes('#')) {
    return DEFAULT_CALLBACK_PATH
  }

  return path.replace(/\/+$/, '') || '/'
}

export const PLAYER_IDENTITY_CONFIG = Object.freeze({
  enabled: normalizeBoolean(import.meta.env.VITE_PLAYER_IDENTITY_ENABLED),
  centerOrigin: normalizeHttpsOrigin(import.meta.env.VITE_PLAYER_IDENTITY_CENTER_ORIGIN),
  callbackPath: normalizeCallbackPath(import.meta.env.VITE_PLAYER_IDENTITY_CALLBACK_PATH),
})

export function isPlayerIdentityEnabled() {
  return PLAYER_IDENTITY_CONFIG.enabled && Boolean(PLAYER_IDENTITY_CONFIG.centerOrigin)
}
