import { computed, readonly, shallowRef } from 'vue'
import { playerSessionService } from '@/services/playerSession'
import { PLAYER_SESSION_RESULT, PLAYER_SESSION_STATUS } from '@/shared/auth/playerSessionFlow'
import {
  canCreateGuestAfterMigration,
  readInstalledPwaMigrationState,
  writeInstalledPwaMigrationState,
} from '@/shared/auth/playerSessionMigration'
import { PLAYER_SESSION_CONFIG, isPlayerSessionEnabled } from '@/shared/config/playerSession'

const status = shallowRef(PLAYER_SESSION_STATUS.IDLE)
const userId = shallowRef(null)
const lastErrorCode = shallowRef(null)
const migrationState = shallowRef('not_applicable')
let startupPromise = null
let iframeConfirmationPromise = null

function setStatus(nextStatus, { code = null, nextUserId = null } = {}) {
  status.value = nextStatus
  lastErrorCode.value = code == null ? null : Number(code) || null
  userId.value = nextUserId
}

function applyOutcome(outcome) {
  const code = Number(outcome.response?.status || outcome.response?.body?.code || 0) || null

  if (outcome.result === PLAYER_SESSION_RESULT.AUTHENTICATED) {
    setStatus(PLAYER_SESSION_STATUS.AUTHENTICATED, {
      nextUserId: outcome.response.body.data.user_id,
    })
    return true
  }
  if (outcome.result === PLAYER_SESSION_RESULT.UNAUTHORIZED) {
    setStatus(PLAYER_SESSION_STATUS.RECOVERY_REQUIRED, { code })
    return false
  }
  if (outcome.result === PLAYER_SESSION_RESULT.FATAL_CONFIG) {
    setStatus(PLAYER_SESSION_STATUS.FATAL_CONFIG, { code })
    return false
  }
  if (outcome.result === PLAYER_SESSION_RESULT.LOCKED) {
    setStatus(PLAYER_SESSION_STATUS.LOCKED, { code })
    return false
  }
  if (outcome.result === PLAYER_SESSION_RESULT.UNAVAILABLE) {
    setStatus(PLAYER_SESSION_STATUS.UNAVAILABLE, { code })
    return false
  }

  setStatus(PLAYER_SESSION_STATUS.CONTRACT_ERROR, { code })
  return false
}

function applyRequestError(error) {
  const code = Number(error?.code || error?.response?.status || error?.response?.body?.code || 0)

  if (code === 401) {
    setStatus(PLAYER_SESSION_STATUS.RECOVERY_REQUIRED, { code })
    return
  }
  if (code === 403) {
    setStatus(PLAYER_SESSION_STATUS.FATAL_CONFIG, { code })
    return
  }
  if (code === 423) {
    setStatus(PLAYER_SESSION_STATUS.LOCKED, { code })
    return
  }
  if (code === 200 || code === 402 || code === 405) {
    setStatus(PLAYER_SESSION_STATUS.CONTRACT_ERROR, { code })
    return
  }

  setStatus(PLAYER_SESSION_STATUS.UNAVAILABLE, { code: code || null })
}

function resolveMigrationState() {
  if (!PLAYER_SESSION_CONFIG.installedPwaMigrationRequired) return 'not_applicable'
  return readInstalledPwaMigrationState()
}

function resolveInvite() {
  if (typeof window === 'undefined') return 0

  const params = new URLSearchParams(window.location.search)
  const invite = Number(params.get('invite') || params.get('invite_code') || 0)
  return Number.isInteger(invite) && invite > 0 ? invite : 0
}

async function bootstrapAndMaybeRegister({ pwaInfo = {}, allowRegistration = false } = {}) {
  setStatus(PLAYER_SESSION_STATUS.BOOTSTRAPPING)

  const outcome = await playerSessionService.bootstrap()
  if (outcome.result !== PLAYER_SESSION_RESULT.REGISTRATION_REQUIRED) {
    applyOutcome(outcome)
    return outcome
  }

  if (!allowRegistration) {
    const nextStatus =
      migrationState.value === 'completed'
        ? PLAYER_SESSION_STATUS.RECOVERY_REQUIRED
        : PLAYER_SESSION_STATUS.MIGRATION_REQUIRED
    setStatus(nextStatus, { code: 402 })
    return outcome
  }

  setStatus(PLAYER_SESSION_STATUS.REGISTRATION_REQUIRED, { code: 402 })
  const response = await playerSessionService.registerGuest({
    invite: resolveInvite(),
    pwaInfo,
  })
  setStatus(PLAYER_SESSION_STATUS.AUTHENTICATED, {
    nextUserId: response.body.data.user_id,
  })
  return {
    attempts: outcome.attempts,
    response,
    result: PLAYER_SESSION_RESULT.AUTHENTICATED,
  }
}

async function startInternal({ pwaInfo = {} } = {}) {
  if (!isPlayerSessionEnabled()) return { result: 'disabled' }

  try {
    migrationState.value = resolveMigrationState()
    if (migrationState.value === 'pending') {
      setStatus(PLAYER_SESSION_STATUS.MIGRATION_REQUIRED)
      return { result: PLAYER_SESSION_STATUS.MIGRATION_REQUIRED }
    }

    return await bootstrapAndMaybeRegister({
      pwaInfo,
      allowRegistration:
        PLAYER_SESSION_CONFIG.guestRegistrationEnabled &&
        canCreateGuestAfterMigration(migrationState.value),
    })
  } catch (error) {
    applyRequestError(error)
    throw error
  }
}

export function usePlayerSessionStartup() {
  const isAuthenticated = computed(
    () => status.value === PLAYER_SESSION_STATUS.AUTHENTICATED && userId.value != null,
  )
  const canMountIframe = computed(() =>
    [
      PLAYER_SESSION_STATUS.AUTHENTICATED,
      PLAYER_SESSION_STATUS.MIGRATION_REQUIRED,
      PLAYER_SESSION_STATUS.RECOVERY_REQUIRED,
    ].includes(status.value),
  )
  function start(options = {}) {
    if (!startupPromise) {
      startupPromise = startInternal(options).finally(() => {
        startupPromise = null
      })
    }
    return startupPromise
  }

  function confirmIframeLogin() {
    if (!iframeConfirmationPromise) {
      iframeConfirmationPromise = (async () => {
        const outcome = await playerSessionService.bootstrap()
        if (applyOutcome(outcome)) {
          migrationState.value = 'completed'
          writeInstalledPwaMigrationState('completed')
        }
        return outcome
      })()
        .catch((error) => {
          applyRequestError(error)
          throw error
        })
        .finally(() => {
          iframeConfirmationPromise = null
        })
    }
    return iframeConfirmationPromise
  }

  return {
    status: readonly(status),
    userId: readonly(userId),
    lastErrorCode: readonly(lastErrorCode),
    migrationState: readonly(migrationState),
    isAuthenticated,
    canMountIframe,
    start,
    confirmIframeLogin,
  }
}
