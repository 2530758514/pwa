import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { appendFacebookAttributionParams } from '../src/shared/analytics/facebookAttributionParams.js'

const iframeShellSource = readFileSync(
  new URL('../src/components/pwa/PwaIframeShell.vue', import.meta.url),
  'utf8',
)
const installPageSource = readFileSync(
  new URL('../src/components/pwa/PwaInstallPage.vue', import.meta.url),
  'utf8',
)

test('maps only stored Facebook attribution fields to the H5 iframe query', () => {
  const params = new URLSearchParams('handoff_grant=must-not-change')

  appendFacebookAttributionParams(params, {
    fbclid: 'facebook-click',
    fbc: 'fb.1.123.facebook-click',
    fbp: 'fb.1.456.browser',
    event_source_url: 'https://pwa.example.com/?fbclid=facebook-click',
    token: 'must-not-forward',
    handoff_grant: 'must-not-forward',
  })

  assert.deepEqual(Object.fromEntries(params), {
    handoff_grant: 'must-not-change',
    fbclid: 'facebook-click',
    'x-fbc': 'fb.1.123.facebook-click',
    'x-fbp': 'fb.1.456.browser',
    event_source_url: 'https://pwa.example.com/?fbclid=facebook-click',
  })
  assert.equal(params.has('token'), false)
})

test('lets fresh PWA URL parameters override the stored fallback', () => {
  const params = new URLSearchParams()

  appendFacebookAttributionParams(params, {
    fbclid: 'stored-click',
    fbc: 'stored-fbc',
  })
  new URLSearchParams('fbclid=fresh-click&x-fbc=fresh-fbc').forEach((value, key) => {
    params.set(key, value)
  })

  assert.equal(params.get('fbclid'), 'fresh-click')
  assert.equal(params.get('x-fbc'), 'fresh-fbc')
})

test('restores stored Facebook attribution before copying the current PWA query', () => {
  const start = iframeShellSource.indexOf('function resolveIframeUrl')
  const end = iframeShellSource.indexOf('const detailH5Url', start)
  const resolveIframeUrlSource = iframeShellSource.slice(start, end)

  const storedAttributionIndex = resolveIframeUrlSource.indexOf(
    'appendStoredPwaFacebookAttributionParams(targetUrl.searchParams)',
  )
  const currentQueryIndex = resolveIframeUrlSource.indexOf(
    'applySearchParams(targetUrl.searchParams, new URLSearchParams(window.location.search))',
  )

  assert.ok(storedAttributionIndex >= 0)
  assert.ok(currentQueryIndex > storedAttributionIndex)
  assert.doesNotMatch(resolveIframeUrlSource, /handoff_grant|code_verifier|token/)
})

test('restores stored Facebook attribution before redirecting the landing tab to H5', () => {
  const start = installPageSource.indexOf('function resolvePwaRedirectUrl')
  const end = installPageSource.indexOf('function resolveH5RedirectUrl', start)
  const resolveRedirectUrlSource = installPageSource.slice(start, end)

  const storedAttributionIndex = resolveRedirectUrlSource.indexOf(
    'appendStoredPwaFacebookAttributionParams(targetUrl.searchParams)',
  )
  const currentQueryIndex = resolveRedirectUrlSource.indexOf(
    'appendSearchParams(targetUrl.searchParams, new URLSearchParams(window.location.search))',
  )

  assert.ok(storedAttributionIndex >= 0)
  assert.ok(currentQueryIndex > storedAttributionIndex)
  assert.match(installPageSource, /const DIRECT_H5_BLOCKED_PARAM_NAMES = new Set\(/)
  assert.match(resolveRedirectUrlSource, /removeBlockedDirectH5Params\(targetUrl\.searchParams\)/)
  assert.match(
    installPageSource,
    /DIRECT_H5_BLOCKED_PARAM_NAMES\.has\(key\.toLowerCase\(\)\)/,
  )
  assert.match(installPageSource, /'handoff_grant'/)
  assert.match(installPageSource, /'code_verifier'/)
  assert.match(installPageSource, /'pwa_app'/)
  assert.match(installPageSource, /'token'/)
})
