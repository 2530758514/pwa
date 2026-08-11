import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  PLAYER_SESSION_RESULT,
  PLAYER_SESSION_STATUS,
  canMountPlayerSessionIframe,
  classifyPlayerSessionBootstrapResponse,
  runPlayerSessionBootstrap,
} from '../src/shared/auth/playerSessionFlow.js'
import {
  PLAYER_SESSION_READY,
  createPlayerSessionParentResponse,
  parsePlayerSessionReadyNotification,
  parsePlayerSessionRequest,
} from '../src/shared/auth/playerSessionMessages.js'
import {
  canCreateGuestAfterMigration,
  readInstalledPwaMigrationState,
  writeInstalledPwaMigrationState,
} from '../src/shared/auth/playerSessionMigration.js'
import { rewriteApiProxyPath } from '../src/shared/api/proxyPath.js'

function response(status, data = null) {
  return {
    status,
    body: { code: status, data, msg: status === 200 ? 'OK' : 'error' },
  }
}

class MemoryStorage {
  #values = new Map()

  getItem(key) {
    return this.#values.get(key) ?? null
  }

  setItem(key, value) {
    this.#values.set(key, String(value))
  }
}

test('bootstrap waits for the first 401 cleanup and retries only once', async () => {
  const calls = []
  const responses = [response(401), response(200, { authenticated: true, user_id: 123 })]
  const outcome = await runPlayerSessionBootstrap({
    request: async (input) => {
      calls.push(input)
      return responses.shift()
    },
  })

  assert.equal(outcome.result, PLAYER_SESSION_RESULT.AUTHENTICATED)
  assert.equal(outcome.attempts, 2)
  assert.equal(calls.length, 2)
})

test('two consecutive bootstrap 401 responses stop without registration', async () => {
  let requestCount = 0
  const outcome = await runPlayerSessionBootstrap({
    request: async () => {
      requestCount += 1
      return response(401)
    },
  })

  assert.equal(requestCount, 2)
  assert.equal(outcome.result, PLAYER_SESSION_RESULT.UNAUTHORIZED)
})

test('mounts H5 recovery after non-security Session startup failures', () => {
  ;[
    PLAYER_SESSION_STATUS.MIGRATION_REQUIRED,
    PLAYER_SESSION_STATUS.AUTHENTICATED,
    PLAYER_SESSION_STATUS.RECOVERY_REQUIRED,
    PLAYER_SESSION_STATUS.UNAVAILABLE,
    PLAYER_SESSION_STATUS.CONTRACT_ERROR,
  ].forEach((status) => assert.equal(canMountPlayerSessionIframe(status), true, status))

  ;[
    PLAYER_SESSION_STATUS.IDLE,
    PLAYER_SESSION_STATUS.BOOTSTRAPPING,
    PLAYER_SESSION_STATUS.REGISTRATION_REQUIRED,
    PLAYER_SESSION_STATUS.LOCKED,
    PLAYER_SESSION_STATUS.FATAL_CONFIG,
  ].forEach((status) => assert.equal(canMountPlayerSessionIframe(status), false, status))
})

test('402 is registration-required only for the exact bootstrap contract', () => {
  assert.equal(
    classifyPlayerSessionBootstrapResponse(response(402, { registration_required: true })),
    PLAYER_SESSION_RESULT.REGISTRATION_REQUIRED,
  )
  assert.equal(
    classifyPlayerSessionBootstrapResponse(response(402)),
    PLAYER_SESSION_RESULT.CONTRACT_ERROR,
  )
})

test('parent bridge messages require exact request id and state shapes', () => {
  const requestId = 'r'.repeat(24)
  const state = 's'.repeat(32)
  const request = {
    type: 'PLAYER_SESSION_REQUEST',
    version: 1,
    request_id: requestId,
  }

  assert.deepEqual(parsePlayerSessionRequest(request), {
    type: 'PLAYER_SESSION_REQUEST',
    requestId,
  })
  assert.equal(parsePlayerSessionRequest({ ...request, token: 'secret' }), null)
  assert.deepEqual(createPlayerSessionParentResponse(PLAYER_SESSION_READY, requestId, state), {
    type: PLAYER_SESSION_READY,
    version: 1,
    request_id: requestId,
    state,
  })
  assert.deepEqual(
    parsePlayerSessionReadyNotification({ type: PLAYER_SESSION_READY, version: 1, state }, state),
    { type: PLAYER_SESSION_READY, state },
  )
  assert.equal(
    parsePlayerSessionReadyNotification(
      { type: PLAYER_SESSION_READY, version: 1, state, token: 'secret' },
      state,
    ),
    null,
  )
})

test('missing migration evidence stays pending and cannot create a guest', () => {
  const storage = new MemoryStorage()

  assert.equal(readInstalledPwaMigrationState(storage), 'pending')
  assert.equal(canCreateGuestAfterMigration('pending'), false)
  assert.equal(writeInstalledPwaMigrationState('no_legacy_identity', storage), true)
  assert.equal(readInstalledPwaMigrationState(storage), 'no_legacy_identity')
  assert.equal(canCreateGuestAfterMigration('no_legacy_identity'), true)
  assert.equal(canCreateGuestAfterMigration('completed'), false)
})

test('development proxy preserves new Session routes and strips legacy API routes', () => {
  const options = { proxyPrefix: '/api', rewritePrefix: '', stripPrefix: true }

  assert.equal(
    rewriteApiProxyPath('/api/player/session/bootstrap', options),
    '/api/player/session/bootstrap',
  )
  assert.equal(rewriteApiProxyPath('/api/sse', options), '/api/sse')
  assert.equal(rewriteApiProxyPath('/api/web_user_info_list', options), '/web_user_info_list')
})

test('production delegates Cookie bootstrap and guest registration to the play08 iframe', async () => {
  const [productionEnv, appSource, mainSource, shellSource, indexSource] =
    await Promise.all([
      readFile(new URL('../.env.production', import.meta.url), 'utf8'),
      readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
      readFile(new URL('../src/components/pwa/PwaIframeShell.vue', import.meta.url), 'utf8'),
      readFile(new URL('../index.html', import.meta.url), 'utf8'),
    ])

  assert.match(productionEnv, /VITE_PLAYER_SESSION_ENABLED=true/)
  assert.match(productionEnv, /VITE_PLAYER_IDENTITY_ENABLED=false/)
  assert.match(productionEnv, /VITE_H5_APP_URL=https:\/\/play08\.draft7bk\.uk/)
  assert.match(productionEnv, /VITE_PLAYER_SESSION_INSTALLED_PWA_MIGRATION_REQUIRED=false/)
  assert.match(productionEnv, /VITE_PLAYER_SESSION_GUEST_REGISTRATION_ENABLED=false/)
  assert.match(appSource, /const playerIdentityEnabled = !playerSessionEnabled/)
  assert.match(appSource, /const identityReady = shallowRef\(!playerIdentityEnabled\)/)
  assert.match(appSource, /<PwaIframeShell\s+v-if="isShellRuntime"/)
  assert.doesNotMatch(appSource, /usePlayerSessionStartup|startPlayerSession|canMountIframe/)
  assert.match(mainSource, /if \(!isPlayerSessionEnabled\(\) && isPlayerIdentityEnabled\(\)\)/)
  assert.match(shellSource, /const playerIdentityEnabled = !playerSessionEnabled/)
  assert.doesNotMatch(
    shellSource,
    /handlePlayerSessionIframeMessage|playerSessionStatus|player-session-refresh/,
  )
  assert.match(indexSource, /!playerSessionEnabled &&[\s\S]*VITE_PLAYER_IDENTITY_ENABLED/)
})
