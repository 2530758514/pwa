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

test('landing page delegates to the shared H5 builder with stored attribution', () => {
  const shared = readFileSync(new URL('../src/shared/pwa/landingH5Url.js', import.meta.url), 'utf8')
  const service = readFileSync(new URL('../src/services/landingH5Redirect.js', import.meta.url), 'utf8')
  assert.match(installPageSource, /resolveLandingH5Url\(url, props.pwaInfo, isApplePwaRedirectDevice.value\)/)
  assert.match(service, /appendFacebook: appendStoredPwaFacebookAttributionParams/)
  assert.match(service, /appendBigo: appendBigoAttributionParams/)
  assert.ok(shared.indexOf('appendFacebook(targetUrl.searchParams)') < shared.indexOf('appendSearchParams(targetUrl.searchParams, new URLSearchParams(location.search))'))
  for (const field of ['handoff_grant', 'code_verifier', 'pwa_app', 'token']) assert.ok(shared.includes(`'${field}'`))
})
