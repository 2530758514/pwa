import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync(
  new URL('../src/components/pwa/PwaInstallPage.vue', import.meta.url),
  'utf8',
)
const action = source.slice(
  source.indexOf('function handlePopupDownload('),
  source.indexOf('onMounted(() => {', source.indexOf('function handlePopupDownload(')),
)
function setup(ios) {
  const calls = []
  let timeout
  const context = {
    isStandalone: { value: false },
    installing: { value: false },
    installVisualActive: { value: false },
    postInstallOpenRequested: { value: false },
    shouldAttemptInstalledPwaOpen: () => false,
    shouldUseOpenBrowserGuide: { value: false },
    isApplePwaRedirectDevice: { value: ios },
    notifyBigoAppDownload: () => {},
    redirectToH5Page: () => {
      calls.push('redirect')
    },
    runNativeInstallPrompt: () => {
      calls.push('native')
      return Promise.resolve()
    },
    window: {
      setTimeout: (fn, ms) => {
        assert.equal(ms, 200)
        timeout = fn
        return 1
      },
      clearTimeout() {},
    },
  }
  return {
    run: runInNewContext(`${action}\nhandlePopupDownload`, context),
    calls,
    expire: () => timeout(),
  }
}
test('iOS redirect has a hard local deadline and never waits for a statistics response', async () => {
  const f = setup(true)
  let finish = 0
  f.run(
    {
      finish: () => {
        finish++
      },
    },
    new Promise(() => {}),
  )
  assert.equal(f.calls.length, 0)
  f.expire()
  for (let i = 0; i < 10; i++) await Promise.resolve()
  assert.deepEqual(f.calls, ['redirect'])
  assert.equal(finish, 1)
})
test('Android native prompt remains synchronous and does not wait for telemetry', async () => {
  const f = setup(false)
  f.run(undefined, new Promise(() => {}))
  assert.deepEqual(f.calls, ['native'])
})
