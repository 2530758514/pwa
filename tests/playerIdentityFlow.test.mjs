import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearHandoffFlow,
  createAutomaticClientId,
  isValidHandoffFlow,
  parseHandoffCallbackFragment,
  readHandoffFlow,
  writeHandoffFlow,
} from '../src/shared/auth/playerIdentityFlow.js'
import {
  createPlayerIdentityHandoffError,
  createPlayerIdentityHandoffResponse,
  parsePlayerIdentityHandoffRequest,
} from '../src/shared/auth/playerIdentityMessages.js'

const STATE = 'A'.repeat(43)
const PWA_CLIENT_ID = 'auto_h5_63b22269976bae2fda7d36ad13d42adee76799c6ceeb766e64fb09300548060c'
const H5_CLIENT_ID = 'auto_h5_929ea700556a72970a42bc746b2b4dcbb3ab6df79005072345a3b90297b0b7fe'

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
