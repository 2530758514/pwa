import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { buildLandingH5Url } from '../src/shared/pwa/landingH5Url.js'
import { applyPwaIdentityParams } from '../src/shared/pwa/identityParams.js'
import { isFacebookInAppBrowserRuntime } from '../src/shared/pwa/installIdentityHandoff.js'

// Frozen pre-change implementation verifies compatibility after future commits too.
const original = readFileSync(new URL('./fixtures/originalLandingRedirect.txt', import.meta.url), 'utf8')
for (const isApple of [false, true]) {
  test(`shared H5 builder preserves original output (Apple=${isApple})`, () => {
    const location = { origin: 'https://entry.test', search: '?campaign=entry&token=secret&pwa_id=spoof&dup=1&dup=2&empty=', hash: '#/route?campaign=hash&other=hash&state=secret' }
    const pwaInfo = { pwa_id: 123, pwa_url_id: 456 }
    const appendFacebook = p => { p.set('fbclid', 'saved'); p.set('event_source_url', 'https://entry.test/?fbclid=saved') }
    const appendBigo = p => { p.delete('bigo_click_id'); p.set('bbg', 'bigo') }
    const context = vm.createContext({ URL, URLSearchParams, window: { location }, props: { pwaInfo }, isApplePwaRedirectDevice: { value: isApple }, applyPwaIdentityParams, appendStoredPwaFacebookAttributionParams: appendFacebook, appendBigoAttributionParams: appendBigo })
    vm.runInContext(`const IOS_H5_REDIRECT_PARAM='pwa_ios_h5_redirect'; const IOS_H5_REDIRECT_VALUE='1'; ${original}`, context)
    for (const target of ['https://h5.test/play?campaign=target&token=secret&bigo_click_id=old#/game', '/play', 'javascript:invalid', '']) {
      context.target = target
      assert.equal(buildLandingH5Url(target, { location, pwaInfo, isApple, appendFacebook, appendBigo }), vm.runInContext('resolvePwaRedirectUrl(target)', context))
    }
  })
}
test('Facebook environment detection works without advertising query parameters', () => {
  for (const userAgent of ['Android FBAV/123', 'iPhone FBIOS FBAN/FBIOS', 'iPad FB_IAB']) assert.equal(isFacebookInAppBrowserRuntime({ userAgent, platform: '' }), true)
  for (const userAgent of ['Android Chrome/123', 'iPhone Safari/605', 'Windows Chrome/123']) assert.equal(isFacebookInAppBrowserRuntime({ userAgent, platform: '' }), false)
})
