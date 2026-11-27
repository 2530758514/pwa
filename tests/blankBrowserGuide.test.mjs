import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBlankBrowserOpenUrl, createBlankBrowserOpener, formatBlankBrowserReward } from '../src/shared/pwa/blankBrowserOpen.js'

const entry = 'https://landing.example/page?fbclid=a%2Bb&pwa_id=7#/game?campaign=one'
function harness(target = buildBlankBrowserOpenUrl(entry, true)) {
  let clock = 0, timerId = 0, allowed = true
  const timers = new Map(), opened = [], fallbacks = []
  const opener = createBlankBrowserOpener({ target, navigate: url => opened.push(url), onFallback:()=>fallbacks.push(clock),
    setTimer: (fn, delay) => { const id = ++timerId; timers.set(id, {fn, at:clock+delay}); return id },
    clearTimer: id => timers.delete(id), now:()=>clock, canOpen:()=>allowed })
  function advance(ms) {
    const end = clock + ms
    for (;;) {
      const pending = [...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0]
      if (!pending) break
      clock = pending[1].at; timers.delete(pending[0]); pending[1].fn()
    }
    clock = end
  }
  return {opener, opened, timers, fallbacks, advance, hide:()=>{allowed=false}, show:()=>{allowed=true} }
}
for (const apple of [true,false]) {
  test(`one automatic attempt per guide on ${apple?'iOS':'Android'}, no repeat on resume/config`, () => {
    const h = harness(buildBlankBrowserOpenUrl(entry, apple))
    h.opener.start(); assert.equal(h.opened.length,1); assert.equal(h.fallbacks.length,1)
    assert.equal(h.timers.size,0)
    h.opener.start(); h.advance(10000); assert.equal(h.opened.length,1)
    h.opener.open(); assert.equal(h.opened.length,2)
    h.opener.open(); assert.equal(h.opened.length,2)
    h.advance(800); h.opener.open(); assert.equal(h.opened.length,3)
  })
}
test('an early manual call does not duplicate the immediate automatic dispatch', () => {
  const h = harness(); h.opener.start(); h.advance(100); h.opener.open()
  assert.equal(h.opened.length,1); assert.equal(h.timers.size,0)
  h.advance(5000); h.opener.start(); h.advance(2000); assert.equal(h.opened.length,1)
})
test('dispose clears timer and prevents late clicks', () => {
  const h = harness(); h.opener.start(); h.opener.dispose(); h.advance(10000); h.opener.open()
  assert.equal(h.timers.size,0); assert.equal(h.opened.length,1); assert.equal(h.fallbacks.length,1)
})
test('hidden pages skip the one automatic attempt without retrying', () => {
  const h = harness(); h.hide(); h.opener.start(); h.advance(1000); h.opener.start(); h.advance(5000)
  assert.equal(h.opened.length,0); assert.equal(h.timers.size,0)
})
test('iOS HTTP debugging remains manual; malformed targets never dispatch', () => {
  for (const url of ['http://localhost:4011/', 'javascript:alert(1)', '', 'https://user:pass@example.test/']) {
    assert.equal(buildBlankBrowserOpenUrl(url,true),'')
  }
  const h = harness(''); h.opener.start(); h.opener.open(); h.advance(10000)
  assert.equal(h.opened.length,0); assert.equal(h.timers.size,0)
})
test('Safari and Chrome targets preserve the landing address, parameters and hash', () => {
  assert.equal(buildBlankBrowserOpenUrl(entry,true),entry.replace('https:','x-safari-https:'))
  const chrome = buildBlankBrowserOpenUrl(entry,false)
  assert.ok(chrome.startsWith('intent://landing.example/page?fbclid=a%2Bb&pwa_id=7#/game?campaign=one#Intent;'))
  assert.ok(chrome.includes('package=com.android.chrome'))
  assert.ok(chrome.includes(`S.browser_fallback_url=${encodeURIComponent(entry)};end`))
})
test('confirmed rewards include zero, decimals and long amounts without placeholders', () => {
  assert.equal(formatBlankBrowserReward('27',false),'')
  assert.equal(formatBlankBrowserReward('27',true),'$27')
  assert.equal(formatBlankBrowserReward(0,true),'$0')
  assert.equal(formatBlankBrowserReward('20.50',true),'$20.5')
  assert.equal(formatBlankBrowserReward('123456789.12',true),'$123,456,789.12')
  for(const v of ['', ' ', null, undefined, -1, 'NaN', Infinity, true, {}, '$20', '0x20']) assert.equal(formatBlankBrowserReward(v,true),'')
})
test('a rejected native scheme keeps controller available for a later user retry', () => {
  let clock=0, calls=0
  const opener=createBlankBrowserOpener({target:'x-safari-https://example.test', navigate:()=>{calls++;throw Error('blocked')},now:()=>clock})
  assert.doesNotThrow(()=>opener.open()); clock=1000
  assert.doesNotThrow(()=>opener.open()); assert.equal(calls,2)
})

test('backgrounded handoff reveals on return without another automatic attempt', () => {
  let visible=true, calls=0, shown=0
  const opener=createBlankBrowserOpener({target:'x-safari-https://example.test',navigate:()=>{calls++;visible=false},canOpen:()=>visible,onFallback:()=>{shown++}})
  opener.start(); assert.equal(calls,1); assert.equal(shown,0)
  visible=true; opener.resume(); opener.resume(); opener.start()
  assert.equal(shown,1); assert.equal(calls,1)
})
test('native dispatch runs before immediate fallback rendering with no timer or wait', () => {
  const order=[]
  const opener=createBlankBrowserOpener({target:'x-safari-https://example.test',navigate:()=>order.push('dispatch'),setTimer:()=>{throw Error('unexpected delay')},onFallback:()=>order.push('guide')})
  opener.start(); assert.deepEqual(order,['dispatch','guide'])
})
