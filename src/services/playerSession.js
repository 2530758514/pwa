import { playerSessionApi } from '@/api/playerSession'
import {
  PLAYER_SESSION_RESULT,
  classifyPlayerSessionBootstrapResponse,
  createSingleFlight,
  runPlayerSessionBootstrap,
} from '@/shared/auth/playerSessionFlow'

const runBootstrapSingleFlight = createSingleFlight()
const runRegisterSingleFlight = createSingleFlight()

function createSessionError(message, response) {
  const error = new Error(message)
  error.code = Number(response?.status || response?.body?.code || 0) || null
  error.response = response
  return error
}

async function registerGuest(options = {}) {
  const response = await playerSessionApi.register(options)
  const result = classifyPlayerSessionBootstrapResponse(response)

  if (
    result !== PLAYER_SESSION_RESULT.AUTHENTICATED ||
    typeof response.body?.data?.created !== 'boolean'
  ) {
    throw createSessionError('player_session_registration_failed', response)
  }

  return response
}

export const playerSessionService = {
  bootstrap() {
    return runBootstrapSingleFlight(() =>
      runPlayerSessionBootstrap({
        request: () => playerSessionApi.bootstrap(),
      }),
    )
  },

  registerGuest(options = {}) {
    return runRegisterSingleFlight(() => registerGuest(options))
  },
}
