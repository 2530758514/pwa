import assert from 'node:assert/strict'
import test from 'node:test'
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
  writeCompletedInstallHandoff,
  writeHandoffFlow,
  writeInstallHandoffFlow,
  writePendingInstallHandoff,
} from '../src/shared/auth/playerIdentityFlow.js'
import {
  createPlayerIdentityParentReady,
  createPlayerIdentityHandoffError,
  createPlayerIdentityHandoffResponse,
  isPlayerIdentityParentReady,
  parsePlayerIdentityHandoffConsumed,
  parsePlayerIdentityHandoffRequest,
} from '../src/shared/auth/playerIdentityMessages.js'
import { isPwaH5AppReadyMessage } from '../src/shared/pwa/iframeLifecycleMessages.js'
import {
  isAndroidFacebookInAppBrowserRuntime,
  isAndroidInstallIdentityHandoffRuntime,
  resolvePwaH5IdentityOrigin,
} from '../src/shared/pwa/installIdentityHandoff.js'

const STATE = 'A'.repeat(43)
const PWA_CLIENT_ID = 'auto_h5_63b22269976bae2fda7d36ad13d42adee76799c6ceeb766e64fb09300548060c'
const H5_CLIENT_ID = 'auto_h5_929ea700556a72970a42bc746b2b4dcbb3ab6df79005072345a3b90297b0b7fe'

test('accepts only the strict parent-ready message', () => {
  const message = createPlayerIdentityParentReady()

  assert.deepEqual(message, {
    type: 'player_identity_parent_ready',
    version: 1,
  })
  assert.equal(isPlayerIdentityParentReady(message), true)
  assert.equal(
    isPlayerIdentityParentReady({ ...message, parent_origin: 'https://pwa.example.com' }),
    false,
  )
  assert.equal(isPlayerIdentityParentReady({ ...message, version: 2 }), false)
})

class MemoryStorage {
  #values = new Map()

  getItem(key) {
    return this.#values.get(key) ?? null
  }

  setItem(key, value) {
    this.#values.set(key, String(value))
  }

  removeItem(key) {
    this.#values.delete(key)
  }
}

test('derives the source client id from the exact PWA Origin', async () => {
  assert.equal(await createAutomaticClientId('https://pwa.example.com'), PWA_CLIENT_ID)
  await assert.rejects(
    createAutomaticClientId('https://pwa.example.com/path'),
    /identity_client_origin_invalid/,
  )
})

test('creates an install PKCE proof without putting a token in storage', async () => {
  const verifier = randomBase64url(32)
  const challenge = await createPkceChallenge(verifier)

  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/)
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/)
})

test('prepares install handoff only in an external Android browser', () => {
  assert.equal(
    isAndroidInstallIdentityHandoffRuntime({
      userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile',
    }),
    true,
  )
  assert.equal(
    isAndroidInstallIdentityHandoffRuntime({
      userAgent: 'Mozilla/5.0 (Linux; Android 15) FBAN/EMA FBAV/500',
    }),
    false,
  )
  assert.equal(
    isAndroidInstallIdentityHandoffRuntime({ userAgent: 'Mozilla/5.0 (iPhone)' }),
    false,
  )
  assert.equal(
    resolvePwaH5IdentityOrigin(
      { h5_url: 'https://h5.example.com/start?from=pwa' },
      { baseOrigin: 'https://pwa.example.com' },
    ),
    'https://h5.example.com',
  )
})

test('shows the Facebook external-browser gate only on Android', () => {
  assert.equal(
    isAndroidFacebookInAppBrowserRuntime({
      userAgent: 'Mozilla/5.0 (Linux; Android 15) FBAN/EMA FBAV/500',
    }),
    true,
  )
  assert.equal(
    isAndroidFacebookInAppBrowserRuntime({
      userAgent: 'Mozilla/5.0 (iPhone) FBIOS/500 FBAV/500',
      platform: 'iPhone',
    }),
    false,
  )
  assert.equal(
    isAndroidFacebookInAppBrowserRuntime({
      userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile',
    }),
    false,
  )
})

test('parses only the strict PWA handoff callback branches', () => {
  assert.deepEqual(
    parseHandoffCallbackFragment(
      `handoff_grant=${'a'.repeat(64)}&handoff_action=exchange&state=${STATE}`,
    ),
    {
      handoff_grant: 'a'.repeat(64),
      handoff_action: 'exchange',
      state: STATE,
    },
  )
  assert.deepEqual(
    parseHandoffCallbackFragment(`error=identity_not_available&state=${STATE}`),
    { error: 'identity_not_available', state: STATE },
  )
  assert.throws(
    () =>
      parseHandoffCallbackFragment(
        `handoff_grant=${'a'.repeat(64)}&handoff_action=exchange&state=${STATE}&token=secret`,
      ),
    /identity_handoff_callback_invalid/,
  )
})

test('accepts only the strict versioned H5 app-ready message', () => {
  assert.equal(
    isPwaH5AppReadyMessage({
      type: 'pwa_h5_app_ready',
      version: 1,
    }),
    true,
  )
  assert.equal(
    isPwaH5AppReadyMessage({
      type: 'pwa_h5_app_ready',
      version: 1,
      token: 'secret',
    }),
    false,
  )
  assert.equal(
    isPwaH5AppReadyMessage({
      type: 'pwa_h5_app_ready',
      version: 2,
    }),
    false,
  )
})

test('accepts only the version 2 H5 handoff request', () => {
  const message = {
    type: 'player_identity_handoff_request',
    version: 2,
    request_id: 'R'.repeat(24),
    target_client_id: H5_CLIENT_ID,
    target_origin: 'https://h5.example.com',
    state: STATE,
    code_challenge: 'C'.repeat(43),
    code_challenge_method: 'S256',
  }

  assert.deepEqual(parsePlayerIdentityHandoffRequest(message), {
    requestId: message.request_id,
    targetClientId: H5_CLIENT_ID,
    targetOrigin: 'https://h5.example.com',
    state: STATE,
    challenge: message.code_challenge,
  })
  assert.equal(parsePlayerIdentityHandoffRequest({ ...message, code_verifier: 'secret' }), null)
  assert.equal(parsePlayerIdentityHandoffRequest({ ...message, version: 1 }), null)
})

test('sends only the approved grant or error response fields', () => {
  const result = {
    requestId: 'R'.repeat(24),
    targetClientId: H5_CLIENT_ID,
    targetOrigin: 'https://h5.example.com',
    state: STATE,
    action: 'provision',
    grant: 'b'.repeat(64),
  }
  const response = createPlayerIdentityHandoffResponse(result)

  assert.deepEqual(response, {
    type: 'player_identity_handoff_response',
    version: 2,
    request_id: result.requestId,
    target_client_id: H5_CLIENT_ID,
    target_origin: 'https://h5.example.com',
    handoff_action: 'provision',
    handoff_grant: 'b'.repeat(64),
    state: STATE,
  })
  assert.equal('code_verifier' in response, false)
  assert.equal('token' in response, false)
  assert.deepEqual(createPlayerIdentityHandoffError(result), {
    type: 'player_identity_handoff_error',
    version: 2,
    request_id: result.requestId,
    state: STATE,
    error: 'handoff_unavailable',
  })
  assert.deepEqual(createPlayerIdentityHandoffError(result, 'install_handoff_missing'), {
    type: 'player_identity_handoff_error',
    version: 2,
    request_id: result.requestId,
    state: STATE,
    error: 'install_handoff_missing',
  })
})

test('sends a strict install response and accepts only its matching consumed receipt', () => {
  const result = {
    mode: 'install',
    requestId: 'R'.repeat(24),
    handoffId: 'H'.repeat(24),
    targetClientId: H5_CLIENT_ID,
    targetOrigin: 'https://h5.example.com',
    state: STATE,
    verifier: 'V'.repeat(43),
    action: 'exchange',
    grant: 'a'.repeat(64),
  }

  assert.deepEqual(createPlayerIdentityHandoffResponse(result), {
    type: 'player_identity_handoff_response',
    version: 3,
    request_id: result.requestId,
    handoff_id: result.handoffId,
    target_client_id: H5_CLIENT_ID,
    target_origin: 'https://h5.example.com',
    handoff_action: 'exchange',
    handoff_grant: 'a'.repeat(64),
    state: STATE,
    code_verifier: 'V'.repeat(43),
  })

  const consumed = {
    type: 'player_identity_handoff_consumed',
    version: 1,
    request_id: result.requestId,
    handoff_id: result.handoffId,
    target_client_id: H5_CLIENT_ID,
    target_origin: 'https://h5.example.com',
  }
  assert.deepEqual(parsePlayerIdentityHandoffConsumed(consumed), {
    requestId: result.requestId,
    handoffId: result.handoffId,
    targetClientId: H5_CLIENT_ID,
    targetOrigin: 'https://h5.example.com',
  })
  assert.equal(parsePlayerIdentityHandoffConsumed({ ...consumed, token: 'secret' }), null)
})

test('persists only public handoff request metadata in PWA sessionStorage', () => {
  const previousWindow = globalThis.window
  globalThis.window = { sessionStorage: new MemoryStorage() }

  try {
    const flow = {
      version: 2,
      requestId: 'R'.repeat(24),
      sourceClientId: PWA_CLIENT_ID,
      targetClientId: H5_CLIENT_ID,
      targetOrigin: 'https://h5.example.com',
      state: STATE,
      challenge: 'C'.repeat(43),
      startedAt: Date.now(),
    }
    writeHandoffFlow(flow)
    assert.equal(isValidHandoffFlow(readHandoffFlow()), true)
    assert.equal('codeVerifier' in readHandoffFlow(), false)
    assert.equal('token' in readHandoffFlow(), false)
    clearHandoffFlow()
    assert.equal(readHandoffFlow(), null)
  } finally {
    globalThis.window = previousWindow
  }
})

test('persists the complete one-time install exchange package in Android localStorage', () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  }

  try {
    const now = Date.now()
    const flow = {
      version: 1,
      type: 'install',
      handoffId: 'H'.repeat(24),
      sourceClientId: PWA_CLIENT_ID,
      targetClientId: H5_CLIENT_ID,
      targetOrigin: 'https://h5.example.com',
      state: STATE,
      verifier: 'V'.repeat(43),
      challenge: 'C'.repeat(43),
      startedAt: now,
    }
    writeInstallHandoffFlow(flow)
    assert.equal(isValidInstallHandoffFlow(readInstallHandoffFlow(), now), true)

    const pending = {
      version: 1,
      type: 'install_pending',
      handoffId: flow.handoffId,
      sourceClientId: flow.sourceClientId,
      targetClientId: flow.targetClientId,
      targetOrigin: flow.targetOrigin,
      state: flow.state,
      verifier: flow.verifier,
      action: 'provision',
      grant: 'b'.repeat(64),
      createdAt: now,
    }
    writePendingInstallHandoff(pending)
    assert.equal(isValidPendingInstallHandoff(readPendingInstallHandoff(), now), true)
    assert.equal('token' in readPendingInstallHandoff(), false)

    const marker = {
      version: 2,
      targetClientId: H5_CLIENT_ID,
      targetOrigin: 'https://h5.example.com',
      completedAt: now,
    }
    writeCompletedInstallHandoff(marker)
    assert.equal(
      isCompletedInstallHandoffForTarget(readCompletedInstallHandoff(), marker),
      true,
    )
    assert.equal(
      isCompletedInstallHandoffForTarget({ ...marker, version: 1 }, marker),
      false,
    )

    clearPendingInstallHandoff()
    clearInstallHandoffFlow()
  } finally {
    globalThis.window = previousWindow
  }
})
