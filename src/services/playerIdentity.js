import {
  clearInstallHandoffFlow,
  clearHandoffFlow,
  clearPendingInstallHandoff,
  createAutomaticClientId,
  createPkceChallenge,
  isCompletedInstallHandoffForTarget,
  isValidHandoffFlow,
  isValidInstallHandoffFlow,
  isValidPendingInstallHandoff,
  parseHandoffCallbackFragment,
  randomBase64url,
  readCompletedInstallHandoff,
  readHandoffFlow,
  readInstallHandoffFlow,
  readPendingInstallHandoff,
  takeHandoffCallbackFragment,
  writeCompletedInstallHandoff,
  writeHandoffFlow,
  writeInstallHandoffFlow,
  writePendingInstallHandoff,
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

function normalizeExactOrigin(value) {
  const origin = String(value || '')

  try {
    return new URL(origin).origin === origin ? origin : ''
  } catch {
    return ''
  }
}

function isMatchingTarget(record, { targetClientId, targetOrigin }) {
  return Boolean(
    record &&
      record.targetClientId === targetClientId &&
      record.targetOrigin === targetOrigin,
  )
}

function completeInstallHandoffInternal({ handoffId = '', targetClientId = '', targetOrigin = '' }) {
  const pending = readPendingInstallHandoff()

  if (
    !isValidPendingInstallHandoff(pending) ||
    pending.handoffId !== handoffId ||
    !isMatchingTarget(pending, { targetClientId, targetOrigin })
  ) {
    return false
  }

  writeCompletedInstallHandoff({
    version: 1,
    targetClientId: pending.targetClientId,
    targetOrigin: pending.targetOrigin,
    completedAt: Date.now(),
  })
  clearPendingInstallHandoff()
  clearInstallHandoffFlow()
  return true
}

function completePendingInstallHandoffForTargetInternal(targetOrigin) {
  const pending = readPendingInstallHandoff()

  if (!isValidPendingInstallHandoff(pending) || pending.targetOrigin !== targetOrigin) {
    return false
  }

  return completeInstallHandoffInternal({
    handoffId: pending.handoffId,
    targetClientId: pending.targetClientId,
    targetOrigin: pending.targetOrigin,
  })
}

async function initializeInternal() {
  if (!isPlayerIdentityEnabled()) return null

  const flow = readHandoffFlow()
  const installFlow = readInstallHandoffFlow()
  const rawCallback = takeHandoffCallbackFragment()
  if (!rawCallback) {
    if (flow && !isValidHandoffFlow(flow)) clearHandoffFlow()
    if (installFlow && !isValidInstallHandoffFlow(installFlow)) clearInstallHandoffFlow()
    const pending = readPendingInstallHandoff()
    if (pending && !isValidPendingInstallHandoff(pending)) clearPendingInstallHandoff()
    return null
  }

  const callback = parseHandoffCallbackFragment(rawCallback)
  const expectedSourceClientId = await createAutomaticClientId(window.location.origin)

  if (
    isValidInstallHandoffFlow(installFlow) &&
    callback.state === installFlow.state &&
    installFlow.sourceClientId === expectedSourceClientId
  ) {
    if (callback.error) {
      clearInstallHandoffFlow()
      throw new Error('identity_handoff_unavailable')
    }

    const pending = Object.freeze({
      version: 1,
      type: 'install_pending',
      handoffId: installFlow.handoffId,
      sourceClientId: installFlow.sourceClientId,
      targetClientId: installFlow.targetClientId,
      targetOrigin: installFlow.targetOrigin,
      state: installFlow.state,
      verifier: installFlow.verifier,
      action: callback.handoff_action,
      grant: callback.handoff_grant,
      createdAt: Date.now(),
    })
    writePendingInstallHandoff(pending)
    clearInstallHandoffFlow()
    return pending
  }

  if (!isValidHandoffFlow(flow)) {
    clearHandoffFlow()
    throw new Error('identity_handoff_state_invalid')
  }

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

async function prepareInstallHandoffInternal(targetOrigin) {
  if (!isPlayerIdentityEnabled()) return null

  await playerIdentityService.initialize()

  const normalizedTargetOrigin = normalizeExactOrigin(targetOrigin)
  if (!normalizedTargetOrigin) throw new Error('identity_handoff_target_invalid')

  const targetClientId = await createAutomaticClientId(normalizedTargetOrigin)
  const target = { targetClientId, targetOrigin: normalizedTargetOrigin }
  const completed = readCompletedInstallHandoff()
  if (isCompletedInstallHandoffForTarget(completed, target)) {
    return Object.freeze({ status: 'completed', ...target })
  }

  const pending = readPendingInstallHandoff()
  if (isValidPendingInstallHandoff(pending) && isMatchingTarget(pending, target)) {
    return Object.freeze({ status: 'pending', ...target })
  }
  if (pending) clearPendingInstallHandoff()

  let flow = readInstallHandoffFlow()
  if (!isValidInstallHandoffFlow(flow) || !isMatchingTarget(flow, target)) {
    clearInstallHandoffFlow()
    const verifier = randomBase64url(32)
    flow = {
      version: 1,
      type: 'install',
      handoffId: randomBase64url(18),
      sourceClientId: await createAutomaticClientId(window.location.origin),
      targetClientId,
      targetOrigin: normalizedTargetOrigin,
      state: randomBase64url(32),
      verifier,
      challenge: await createPkceChallenge(verifier),
      startedAt: Date.now(),
    }
    writeInstallHandoffFlow(flow)
  }

  navigate(createCenterUrl(flow))
}

async function resolveHandoffRequestInternal(request) {
  if (!isPlayerIdentityEnabled()) return null

  await playerIdentityService.initialize()

  const expectedTargetClientId = await createAutomaticClientId(request.targetOrigin)
  if (request.targetClientId !== expectedTargetClientId) {
    throw new Error('identity_handoff_target_invalid')
  }

  const pendingInstallHandoff = readPendingInstallHandoff()
  if (
    isValidPendingInstallHandoff(pendingInstallHandoff) &&
    isMatchingTarget(pendingInstallHandoff, request)
  ) {
    return Object.freeze({
      mode: 'install',
      requestId: request.requestId,
      handoffId: pendingInstallHandoff.handoffId,
      targetClientId: request.targetClientId,
      targetOrigin: request.targetOrigin,
      state: pendingInstallHandoff.state,
      verifier: pendingInstallHandoff.verifier,
      action: pendingInstallHandoff.action,
      grant: pendingInstallHandoff.grant,
    })
  }
  if (pendingInstallHandoff) clearPendingInstallHandoff()

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

  prepareInstallHandoff(targetOrigin) {
    return prepareInstallHandoffInternal(targetOrigin)
  },

  completeInstallHandoff(handoff) {
    if (!isPlayerIdentityEnabled()) return false
    return completeInstallHandoffInternal(handoff)
  },

  completePendingInstallHandoffForTarget(targetOrigin) {
    if (!isPlayerIdentityEnabled()) return false
    return completePendingInstallHandoffForTargetInternal(targetOrigin)
  },
}
