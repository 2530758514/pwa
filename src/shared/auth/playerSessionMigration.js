const STORAGE_KEY = 'PWA_PLAYER_SESSION_MIGRATION_V1'
const TERMINAL_STATES = new Set(['completed', 'no_legacy_identity', 'legacy_token_invalid'])

function getStorage(storageRef) {
  if (storageRef !== undefined) return storageRef
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

export function readInstalledPwaMigrationState(storageRef) {
  try {
    const value = JSON.parse(getStorage(storageRef)?.getItem(STORAGE_KEY) || 'null')
    if (
      value?.version === 1 &&
      TERMINAL_STATES.has(value.state) &&
      Number.isFinite(Number(value.completedAt))
    ) {
      return value.state
    }
  } catch {
    // A missing or corrupt marker is migration-pending, never permission to register.
  }

  return 'pending'
}

export function writeInstalledPwaMigrationState(state, storageRef) {
  if (!TERMINAL_STATES.has(state)) return false

  try {
    getStorage(storageRef)?.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, state, completedAt: Date.now() }),
    )
    return true
  } catch {
    return false
  }
}

export function canCreateGuestAfterMigration(state) {
  return ['not_applicable', 'no_legacy_identity', 'legacy_token_invalid'].includes(state)
}

export { STORAGE_KEY as PLAYER_SESSION_MIGRATION_STORAGE_KEY }
