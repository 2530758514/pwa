import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const firstScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
const VALID_STATE = 'A'.repeat(43)
const VALID_GRANT = 'b'.repeat(64)

function runCallbackBootstrap({
  identityEnabled = true,
  sessionEnabled = false,
  pathname = '/',
  search = '',
  hash = '',
} = {}) {
  const replacements = []
  const htmlClasses = new Set()
  const window = {
    location: { pathname, search, hash },
    history: {
      replaceState(_state, _title, url) {
        replacements.push(url)
      },
    },
  }

  const script = firstScript
    .replace('%VITE_PLAYER_IDENTITY_ENABLED%', String(identityEnabled))
    .replace('%VITE_PLAYER_SESSION_ENABLED%', String(sessionEnabled))

  vm.runInNewContext(script, {
    URLSearchParams,
    Object,
    document: {
      documentElement: {
        classList: {
          add: (value) => htmlClasses.add(value),
        },
      },
    },
    window,
  })

  return { htmlClasses, replacements, window }
}

test('captures and clears a strict memory-only PWA handoff callback', () => {
  const fragment = `handoff_grant=${VALID_GRANT}&handoff_action=exchange&state=${VALID_STATE}`
  const result = runCallbackBootstrap({ search: '?pwa_id=12', hash: `#${fragment}` })

  assert.equal(result.window.__PWA_PLAYER_IDENTITY_CALLBACK_ACTIVE__, true)
  assert.equal(result.window.__PWA_PLAYER_IDENTITY_HANDOFF_CALLBACK_FRAGMENT__, fragment)
  assert.deepEqual(result.replacements, ['/?pwa_id=12'])
})

test('captures the unavailable branch without persisting callback data', () => {
  const fragment = `error=identity_not_available&state=${VALID_STATE}`
  const result = runCallbackBootstrap({ hash: `#${fragment}` })

  assert.equal(result.window.__PWA_PLAYER_IDENTITY_HANDOFF_CALLBACK_FRAGMENT__, fragment)
  assert.deepEqual(result.replacements, ['/'])
})

test('does not intercept normal PWA visits or malformed handoff fragments', () => {
  const invalidHashes = [
    '',
    '#install',
    `#handoff_grant=${VALID_GRANT}&state=${VALID_STATE}`,
    `#handoff_grant=${VALID_GRANT}&handoff_action=exchange&state=${VALID_STATE}&token=secret`,
  ]

  for (const hash of invalidHashes) {
    const result = runCallbackBootstrap({ search: '?fbclid=click-1', hash })
    assert.equal(result.window.__PWA_PLAYER_IDENTITY_CALLBACK_ACTIVE__, undefined)
    assert.deepEqual(result.replacements, [])
  }
})

test('does not intercept handoff callbacks when the global identity switch is disabled', () => {
  const fragment = `handoff_grant=${VALID_GRANT}&handoff_action=exchange&state=${VALID_STATE}`
  const result = runCallbackBootstrap({ identityEnabled: false, hash: `#${fragment}` })

  assert.equal(result.window.__PWA_PLAYER_IDENTITY_CALLBACK_ACTIVE__, undefined)
  assert.equal(result.window.__PWA_PLAYER_IDENTITY_HANDOFF_CALLBACK_FRAGMENT__, undefined)
  assert.deepEqual(result.replacements, [])
  assert.equal(result.htmlClasses.has('player-identity-disabled'), true)
  assert.match(html, /\.player-identity-disabled \.identity-first-paint \{\s+display: none;/)
  assert.match(
    appSource,
    /const identityReady = shallowRef\(!playerIdentityEnabled && !playerSessionEnabled\)/,
  )
})

test('does not intercept identity callbacks while Cookie Session is enabled', () => {
  const fragment = `handoff_grant=${VALID_GRANT}&handoff_action=exchange&state=${VALID_STATE}`
  const result = runCallbackBootstrap({
    identityEnabled: true,
    sessionEnabled: true,
    hash: `#${fragment}`,
  })

  assert.equal(result.window.__PWA_PLAYER_IDENTITY_CALLBACK_ACTIVE__, undefined)
  assert.deepEqual(result.replacements, [])
  assert.equal(result.htmlClasses.has('player-identity-disabled'), true)
})
