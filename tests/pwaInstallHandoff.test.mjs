import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const serviceSource = readFileSync(
  new URL('../src/services/playerIdentity.js', import.meta.url),
  'utf8',
)
const installSource = readFileSync(
  new URL('../src/composables/pwa/usePwaAddToHomeAction.js', import.meta.url),
  'utf8',
)
const launchSource = readFileSync(
  new URL('../src/composables/pwa/usePwaLaunchAction.js', import.meta.url),
  'utf8',
)

test('installation does not acquire or persist an identity grant', () => {
  assert.doesNotMatch(installSource, /playerIdentity|handoff|manifestOverrides/)
  assert.doesNotMatch(launchSource, /handoff|pwa_handoff_code/)
  assert.doesNotMatch(serviceSource, /localStorage|web_token_create|web_refresh_register/)
  assert.doesNotMatch(serviceSource, /h5_url|h5Url/)
})

test('PWA authorization uses its own Origin as the source Client', () => {
  assert.match(serviceSource, /createAutomaticClientId\(window\.location\.origin\)/)
  assert.match(serviceSource, /url\.searchParams\.set\('flow', 'handoff'\)/)
  assert.match(serviceSource, /url\.searchParams\.set\('source_client_id', flow\.sourceClientId\)/)
  assert.match(serviceSource, /url\.searchParams\.set\('target_client_id', flow\.targetClientId\)/)
})
