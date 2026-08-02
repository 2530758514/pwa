import {
  clearHandoffFlow,
  createAutomaticClientId,
  isValidHandoffFlow,
  parseHandoffCallbackFragment,
  readHandoffFlow,
  takeHandoffCallbackFragment,
  writeHandoffFlow,
} from '@/shared/auth/playerIdentityFlow'
import { isPlayerIdentityEnabled, PLAYER_IDENTITY_CONFIG } from '@/shared/config/playerIdentity'

let initializationPromise = null
let callbackResult = null

export class PlayerIdentityNavigationError extends Error {
  constructor() {
    super('identity_navigation_started')
    this.code = 'identity_navigation_started'
    this.navigationStarted = true
  }
}

export function isPlayerIdentityError(error) {
  return String(error?.code || error?.message || '').startsWith('identity_')
}

function navigate(url) {
  window.location.replace(url)
  throw new PlayerIdentityNavigationError()
}

function isSameRequest(flow, request) {
  return Boolean(
    flow &&
      flow.requestId === request.requestId &&
      flow.targetClientId === request.targetClientId &&
      flow.targetOrigin === request.targetOrigin &&
      flow.state === request.state &&
      flow.challenge === request.challenge,
  )
}

function createCenterUrl(flow) {
  const url = new URL('/', PLAYER_IDENTITY_CONFIG.centerOrigin)
  url.searchParams.set('flow', 'handoff')
  url.searchParams.set('source_client_id', flow.sourceClientId)
  url.searchParams.set('target_client_id', flow.targetClientId)
  url.searchParams.set('state', flow.state)
  url.searchParams.set('code_challenge', flow.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

async function initializeInternal() {
  if (!isPlayerIdentityEnabled()) return null

  const flow = readHandoffFlow()
  const rawCallback = takeHandoffCallbackFragment()
  if (!rawCallback) {
    if (flow && !isValidHandoffFlow(flow)) clearHandoffFlow()
    return null
  }

  if (!isValidHandoffFlow(flow)) {
    clearHandoffFlow()
    throw new Error('identity_handoff_state_invalid')
  }

  const callback = parseHandoffCallbackFragment(rawCallback)
  const expectedSourceClientId = await createAutomaticClientId(window.location.origin)
  if (callback.state !== flow.state || flow.sourceClientId !== expectedSourceClientId) {
    clearHandoffFlow()
    throw new Error('identity_handoff_state_invalid')
  }

  callbackResult = Object.freeze({
    requestId: flow.requestId,
    targetClientId: flow.targetClientId,
    targetOrigin: flow.targetOrigin,
    state: flow.state,
    action: callback.handoff_action || '',
    grant: callback.handoff_grant || '',
    error: callback.error || '',
  })
  return callbackResult
}

async function resolveHandoffRequestInternal(request) {
  await playerIdentityService.initialize()

  const expectedTargetClientId = await createAutomaticClientId(request.targetOrigin)
  if (request.targetClientId !== expectedTargetClientId) {
    throw new Error('identity_handoff_target_invalid')
  }

  if (callbackResult && isSameRequest(callbackResult, request)) {
    if (callbackResult.error) {
      clearHandoffFlow()
      throw new Error('identity_handoff_unavailable')
    }
    return callbackResult
  }

  const existingFlow = readHandoffFlow()
  if (isValidHandoffFlow(existingFlow)) {
    clearHandoffFlow()
    throw new Error('identity_handoff_unavailable')
  }

  const flow = {
    version: 2,
    requestId: request.requestId,
    sourceClientId: await createAutomaticClientId(window.location.origin),
    targetClientId: request.targetClientId,
    targetOrigin: request.targetOrigin,
    state: request.state,
    challenge: request.challenge,
    startedAt: Date.now(),
  }
  writeHandoffFlow(flow)
  navigate(createCenterUrl(flow))
}

export const playerIdentityService = {
  initialize() {
    if (!initializationPromise) {
      initializationPromise = initializeInternal().catch((error) => {
        initializationPromise = null
        throw error
      })
    }
    return initializationPromise
  },

  resolveHandoffRequest(request) {
    return resolveHandoffRequestInternal(request)
  },
}
