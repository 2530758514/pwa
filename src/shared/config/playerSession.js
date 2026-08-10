function normalizeBoolean(value) {
  return (
    String(value || '')
      .trim()
      .toLowerCase() === 'true'
  )
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || '').trim())
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return ''
    }
    return url.origin
  } catch {
    return ''
  }
}

function normalizeOriginList(value) {
  return Object.freeze(
    String(value || '')
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean),
  )
}

export const PLAYER_SESSION_CONFIG = Object.freeze({
  enabled: normalizeBoolean(import.meta.env.VITE_PLAYER_SESSION_ENABLED),
  iframeOrigins: normalizeOriginList(import.meta.env.VITE_PLAYER_SESSION_IFRAME_ORIGINS),
  installedPwaMigrationRequired: normalizeBoolean(
    import.meta.env.VITE_PLAYER_SESSION_INSTALLED_PWA_MIGRATION_REQUIRED,
  ),
  guestRegistrationEnabled: normalizeBoolean(
    import.meta.env.VITE_PLAYER_SESSION_GUEST_REGISTRATION_ENABLED,
  ),
})

export function isPlayerSessionEnabled() {
  return PLAYER_SESSION_CONFIG.enabled
}
