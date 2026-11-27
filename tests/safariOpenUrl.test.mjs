import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { buildSafariOpenUrl } from '../src/shared/pwa/safariOpenUrl.js'

const url = 'https://landing.example/?fbclid=a%2Bb&pwa_id=7#/page?campaign=hello%20world'
test('Safari scheme retains the PWA entry path, attribution and hash', () => {
  assert.equal(buildSafariOpenUrl(url), url.replace('https:', 'x-safari-https:'))
})
test('invalid, credentialed and non HTTPS targets stay on manual fallback', () => {
  for (const value of ['', '/relative', 'http://localhost:4011/', 'javascript:alert(1)', 'https://u:p@host.test/']) assert.equal(buildSafariOpenUrl(value), '')
})
// Exercise the actual gate script with lifecycle hooks stubbed: iOS must not
// launch without a click, and the explicit click must synchronously dispatch once.
function mountGate(userAgent) {
  const file = readFileSync(new URL('../src/components/pwa/PwaFacebookBrowserGate.vue', import.meta.url), 'utf8')
  const script = file.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
  const navigations = [], listeners = [], timers = [], mounts = []
  const location = { href: url, origin: 'https://landing.example' }
  Object.defineProperty(location, 'href', {get:()=>url, set:value=>navigations.push(value)})
  const context = vm.createContext({ URL, navigator:{userAgent, platform:'',maxTouchPoints:0}, window:{location, addEventListener:(...args)=>listeners.push(args),setTimeout:(fn)=>timers.push(fn)},
    defineOptions:()=>{}, defineProps:()=>({includeIos:true}), shallowRef:value=>({value}), t:key=>key, onMounted:fn=>mounts.push(fn),onBeforeUnmount:()=>{},
    isFacebookInAppBrowserRuntime:()=>true,isAndroidFacebookInAppBrowserRuntime:()=>userAgent.includes('Android'),buildSafariOpenUrl })
  vm.runInContext(script, context)
  mounts.forEach(fn=>fn())
  return { context, navigations, listeners, timers }
}
test('iOS Safari dispatch requires a click and does not auto-retry or consume copy actions', () => {
  const gate = mountGate('iPhone FBIOS')
  assert.equal(gate.navigations.length,0)
  assert.equal(gate.timers.length,0)
  assert.deepEqual(gate.listeners.map(x=>x[0]),['pageshow'])
  vm.runInContext("retryOpenFromUserGesture({target:{closest:()=>true}})",gate.context)
  assert.equal(gate.navigations.length,0)
  vm.runInContext('retryOpenFromUserGesture()',gate.context)
  assert.equal(gate.navigations.length,1)
  assert.equal(gate.navigations[0],buildSafariOpenUrl(url))
})
test('Android still uses Chrome Intent and its existing retry flow', () => {
  const gate = mountGate('Android FBAV')
  assert.equal(gate.timers.length,1)
  vm.runInContext('retryOpenFromUserGesture()',gate.context)
  assert.equal(gate.navigations.length,1)
  assert.ok(gate.navigations[0].startsWith('intent://'))
  assert.ok(gate.navigations[0].includes('package=com.android.chrome'))
})
