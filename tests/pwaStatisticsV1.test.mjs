import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPwaAnalytics as createClient,
  detectPlatform,
  normalizeConfig,
  CONTEXT_RESPONSE,
} from '../src/shared/pwa/statisticsClient.js'

const config = { package_mode: 'pwa_first', pwa_id: 56, pwa_url_id: 12 }
const originalNow = Date.now
const originalTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const originalInterval = globalThis.setInterval
const originalClearInterval = globalThis.clearInterval

let clients = []
function createPwaAnalytics(options) {
  const c = createClient(options)
  clients.push(c)
  return c
}
test.afterEach(async () => {
  await Promise.all(clients.map((client) => client.flush()))
  for (const client of clients) client.stop()
  clients = []
  Date.now = originalNow
  Object.assign(globalThis, {
    setTimeout: originalTimeout,
    clearTimeout: originalClearTimeout,
    setInterval: originalInterval,
    clearInterval: originalClearInterval,
  })
})
function environment({
  standalone = false,
  embedded = false,
  offline = false,
  storage = new Map(),
} = {}) {
  let now = originalNow(),
    timerId = 0,
    failStorage = false
  const listeners = new Map(),
    timers = new Map(),
    events = new Map(),
    writes = [],
    sent = []
  const listen = (target, name, fn) => {
    const key = target + name
    if (!listeners.has(key)) listeners.set(key, new Set())
    listeners.get(key).add(fn)
  }
  const surface = (target) => ({
    addEventListener: (name, fn) => listen(target, name, fn),
    removeEventListener: (name, fn) => listeners.get(target + name)?.delete(fn),
  })
  const parent = { postMessage() {} }
  const media = { ...surface('media:'), matches: standalone }
  const win = {
    ...surface('window:'),
    parent,
    location: { origin: 'https://pwa.test' },
    matchMedia: () => media,
  }
  if (!embedded) win.parent = win
  const nav = {
    userAgent: 'Android',
    platform: 'Linux',
    maxTouchPoints: 0,
    onLine: !offline,
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: nav,
  })
  Object.assign(globalThis, {
    window: win,
    location: win.location,
    document: {
      ...surface('document:'),
      visibilityState: 'visible',
      referrer: embedded ? 'https://shell.test/' : '',
    },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    setTimeout: (fn, ms = 0) => {
      const id = ++timerId
      timers.set(id, { fn, due: now + ms })
      return id
    },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, ms) => {
      const id = ++timerId
      timers.set(id, { fn, due: now + ms, interval: ms })
      return id
    },
    clearInterval: (id) => timers.delete(id),
  })
  Date.now = () => now
  const queue = {
    put: async (event) => {
      writes.push(structuredClone(event))
      if (failStorage) throw new Error('quota')
      events.set(event.event_id, structuredClone(event))
    },
    all: async () => [...events.values()],
    remove: async (id) => events.delete(id),
  }
  const send = async (batch) => {
    sent.push(structuredClone(batch))
    return {
      results: batch.map((event) => ({
        event_id: event.event_id,
        status: 'accepted',
      })),
    }
  }
  const tick = async () => {
    for (let i = 0; i < 60; i++) await Promise.resolve()
  }
  async function advance(ms) {
    await tick()
    const end = now + ms
    let count = 0
    while (true) {
      const next = [...timers]
        .filter(([, value]) => value.due <= end)
        .sort((a, b) => a[1].due - b[1].due)[0]
      if (!next) break
      assert.ok(count++ < 1000, 'timer loop')
      const [id, timer] = next
      now = timer.due
      if (timer.interval) timer.due += timer.interval
      else timers.delete(id)
      timer.fn()
      await tick()
    }
    now = end
    await tick()
  }
  const emit = (target, name, event) => {
    for (const fn of listeners.get(target + ':' + name) || []) fn(event)
  }
  return {
    queue,
    send,
    sent,
    writes,
    events,
    storage,
    tick,
    advance,
    emit,
    nav,
    parent,
    media,
    setFailure: (value) => {
      failStorage = value
    },
    time: () => now,
  }
}

test('validates positive binding IDs, explicit mode, Android/iPadOS and unknown devices', () => {
  assert.equal(normalizeConfig({ ...config, package_mode: 'onelink' }), null)
  assert.equal(normalizeConfig({ ...config, pwa_url_id: 0 }), null)
  assert.equal(detectPlatform({ userAgent: 'Windows', platform: 'Win32' }), '')
  assert.equal(
    detectPlatform({
      userAgent: 'Macintosh',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    }),
    'ios',
  )
})
test('one landing per lifecycle, separate clicks, no browser launch, no onelink events', async () => {
  const e = environment()
  const c = createPwaAnalytics(e)
  c.updateConfig(config)
  await c.track('landing_view')
  await e.advance(1000)
  await c.track('landing_view')
  await c.track('standalone_launch')
  await e.tick()
  assert.equal(e.sent.flat().length, 1)
  await c.track('install_click')
  await e.advance(1000)
  await c.track('install_click')
  await e.advance(1000)
  assert.equal(e.sent.flat().length, 3)
  assert.notEqual(e.sent.flat()[1].event_id, e.sent.flat()[2].event_id)
  assert.equal(e.sent.flat()[1].installation_id, null)
  c.updateConfig({ ...config, package_mode: 'onelink' })
  await c.track('install_click')
  await e.advance(1000)
  assert.equal(e.sent.flat().length, 3)
})
test('capture before current configuration waits and keeps the original event time', async () => {
  const e = environment()
  const c = createPwaAnalytics(e)
  await c.track('landing_view')
  await c.track('install_click')
  c.updateConfig(config, { confirmed: false })
  await e.advance(1000)
  assert.equal(e.sent.length, 0)
  c.updateConfig({ ...config, pwa_id: 99 })
  await e.advance(1000)
  const events = e.sent.flat()
  assert.equal(events.length, 2)
  assert.ok(events.every((event) => event.pwa_id === 99))
  assert.ok(Date.parse(events[0].occurred_at) <= e.time() - 1000)
})
for (const name of ['landing_view', 'standalone_launch', 'install_click']) {
  test(`${name}: transient storage failure retries the same event instead of losing it`, async () => {
    const e = environment({ standalone: name === 'standalone_launch' })
    const c = createPwaAnalytics(e)
    c.updateConfig(config)
    await e.tick()
    e.setFailure(true)
    await c.track(name)
    await e.tick()
    assert.equal(e.sent.length, 0)
    const original = e.writes[0]
    e.setFailure(false)
    await e.advance(5000)
    assert.equal(e.sent.flat().length, 1)
    assert.deepEqual(e.sent.flat()[0], original)
    if (name !== 'install_click') {
      await c.track(name)
      await e.advance(1000)
      assert.equal(e.sent.flat().length, 1)
    }
  })
}
test('retry after a lost response preserves IDs and server duplicate does not count twice', async () => {
  const e = environment()
  let fail = true
  const counted = new Set()
  const c = createPwaAnalytics({
    ...e,
    send: async (batch) => {
      e.sent.push(structuredClone(batch))
      const results = batch.map((event) => {
        const duplicate = counted.has(event.event_id)
        counted.add(event.event_id)
        return {
          event_id: event.event_id,
          status: duplicate ? 'duplicate' : 'accepted',
        }
      })
      if (fail) {
        fail = false
        throw new Error('lost response')
      }
      return { results }
    },
  })
  c.updateConfig(config)
  await c.track('install_click')
  await e.tick()
  await e.advance(2000)
  assert.equal(counted.size, 1)
  assert.equal(e.events.size, 0)
  assert.deepEqual(e.sent[0], e.sent[1])
})
test('only ready and visible standalone launches; 30-minute resume creates a new session', async () => {
  const e = environment({ standalone: true })
  const c = createPwaAnalytics(e)
  c.initialize()
  c.updateConfig(config)
  await e.tick()
  assert.equal(e.sent.length, 0)
  globalThis.document.visibilityState = 'hidden'
  c.markReady()
  await e.tick()
  assert.equal(e.sent.length, 0)
  globalThis.document.visibilityState = 'visible'
  e.emit('document', 'visibilitychange')
  await e.advance(1000)
  assert.equal(e.sent.flat().length, 1)
  globalThis.document.visibilityState = 'hidden'
  e.emit('document', 'visibilitychange')
  await e.advance(10000)
  globalThis.document.visibilityState = 'visible'
  e.emit('document', 'visibilitychange')
  await e.tick()
  assert.equal(e.sent.flat().length, 1)
  globalThis.document.visibilityState = 'hidden'
  e.emit('document', 'visibilitychange')
  await e.advance(30 * 60000)
  globalThis.document.visibilityState = 'visible'
  e.emit('document', 'visibilitychange')
  await e.advance(1000)
  const events = e.sent.flat()
  assert.equal(events.length, 2)
  assert.equal(events[0].installation_id, events[1].installation_id)
  assert.notEqual(events[0].launch_id, events[1].launch_id)
  assert.notEqual(events[0].session_id, events[1].session_id)
})
test('online startup ignores old cache, and a fresh onelink response suppresses launch', async () => {
  const e = environment({ standalone: true })
  e.storage.set(
    'pwa-statistics-v1:confirmed-config',
    JSON.stringify({
      origin: globalThis.window.location.origin,
      config,
      directAllowed: true,
    }),
  )
  const c = createPwaAnalytics(e)
  c.initialize()
  c.updateConfig(config, { confirmed: false })
  c.markReady()
  await e.advance(1000)
  assert.equal(e.sent.length, 0)
  c.updateConfig({ ...config, package_mode: 'onelink' })
  await e.advance(1000)
  assert.equal(e.sent.length, 0)
})
test('offline startup uses only this Origin confirmed cache and delivers original event online', async () => {
  const e = environment({ standalone: true, offline: true })
  e.storage.set(
    'pwa-statistics-v1:confirmed-config',
    JSON.stringify({
      origin: globalThis.window.location.origin,
      config,
      directAllowed: true,
    }),
  )
  const c = createPwaAnalytics(e)
  c.initialize()
  c.markReady()
  await e.advance(1000)
  assert.equal(e.events.size, 1)
  assert.equal(e.sent.length, 0)
  const original = [...e.events.values()][0]
  e.nav.onLine = true
  e.emit('window', 'online')
  await e.tick()
  assert.deepEqual(e.sent.flat()[0], original)
})
test('first offline launch with no confirmed config is skipped even after reconnect', async () => {
  const e = environment({ standalone: true, offline: true })
  const c = createPwaAnalytics(e)
  c.initialize()
  c.markReady()
  e.nav.onLine = true
  c.updateConfig(config)
  await e.advance(1000)
  assert.equal(e.sent.length, 0)
})
test('iframe rejects forged context, accepts exact parent, and never sends direct events', async () => {
  const e = environment({ standalone: true, embedded: true })
  const c = createPwaAnalytics(e)
  c.initialize()
  c.updateConfig(config)
  c.markReady()
  await c.track('install_click')
  const ctx = {
    ...config,
    client_id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    installation_id: crypto.randomUUID(),
    display_mode: 'standalone',
    platform: 'android',
  }
  const payload = {
    source: e.parent,
    origin: 'https://evil.test',
    data: { type: CONTEXT_RESPONSE, context: ctx },
  }
  e.emit('window', 'message', payload)
  assert.equal(c.context(), null)
  e.emit('window', 'message', {
    ...payload,
    origin: 'https://shell.test',
    source: {},
  })
  assert.equal(c.context(), null)
  e.emit('window', 'message', { ...payload, origin: 'https://shell.test' })
  const headers = await c.registrationHeaders()
  assert.equal(headers['X-Pwa-Source-Origin'], 'https://shell.test')
  assert.equal(headers['X-Pwa-Installation-Id'], ctx.installation_id)
  assert.equal(e.sent.length, 0)
  c.stop()
})
test('registration receives delayed parent context before the bounded deadline', async () => {
  const e = environment({ embedded: true })
  const c = createPwaAnalytics(e)
  c.initialize()
  const pending = c.registrationHeaders()
  await e.advance(200)
  e.emit('window', 'message', {
    source: e.parent,
    origin: 'https://shell.test',
    data: {
      type: CONTEXT_RESPONSE,
      context: {
        ...config,
        client_id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        installation_id: null,
        display_mode: 'browser',
        platform: 'ios',
      },
    },
  })
  const headers = await pending
  assert.equal(headers['X-Pwa-Platform'], 'ios')
  assert.equal(headers['X-Pwa-Installation-Id'], undefined)
  c.stop()
})
test('context timeout permits registration with no fabricated PWA context', async () => {
  const e = environment({ embedded: true })
  const c = createPwaAnalytics(e)
  const pending = c.registrationHeaders()
  await e.advance(1000)
  assert.deepEqual(await pending, {})
  c.stop()
})
test('limits batches by count and bytes; handles rejected entries and seven-day expiry', async () => {
  const e = environment()
  const base = {
    occurred_at: new Date().toISOString(),
    extra: 'x'.repeat(5000),
  }
  for (let i = 0; i < 8; i++) await e.queue.put({ ...base, event_id: String(i) })
  await e.queue.put({
    ...base,
    event_id: 'expired',
    occurred_at: '2020-01-01T00:00:00.000Z',
  })
  const c = createPwaAnalytics({
    ...e,
    send: async (batch) => {
      e.sent.push(batch)
      assert.ok(batch.length <= 20)
      assert.ok(
        new TextEncoder().encode(JSON.stringify({ schema_version: 1, events: batch })).length <=
          16384,
      )
      return {
        results: batch.map((event) => ({
          event_id: event.event_id,
          status: 'rejected',
          reason: 'invalid_event',
        })),
      }
    },
  })
  await c.flush()
  await e.advance(1000)
  assert.equal(e.sent.flat().length, 8)
  assert.equal(e.events.size, 0)
})
test('invalid batch acknowledgement retains every event', async () => {
  const e = environment()
  const c = createPwaAnalytics({ ...e, send: async () => ({ results: [] }) })
  c.updateConfig(config)
  await c.track('install_click')
  await e.tick()
  assert.equal(e.events.size, 1)
})
test('permanent HTTP error removes only the attempted batch', async () => {
  const e = environment()
  const base = {
    occurred_at: new Date().toISOString(),
    extra: 'x'.repeat(5000),
  }
  for (let i = 0; i < 8; i++) await e.queue.put({ ...base, event_id: String(i) })
  const c = createPwaAnalytics({
    ...e,
    send: async () => {
      throw { response: { status: 422 } }
    },
  })
  await c.flush()
  assert.equal(e.events.size, 5)
})
test('storage remains optional for the registration business result', async () => {
  const e = environment()
  e.setFailure(true)
  const c = createPwaAnalytics(e)
  c.updateConfig(config)
  await c.track('install_click')
  const headers = await c.registrationHeaders()
  assert.equal(headers['X-Pwa-Display-Mode'], 'browser')
})

test('new clicks remain durable during another request and Retry-After blocks early resend', async () => {
  const e = environment()
  let release,
    count = 0
  const c = createPwaAnalytics({
    ...e,
    send: async (batch) => {
      count++
      if (count === 1) {
        await new Promise((resolve) => {
          release = resolve
        })
        throw { response: { status: 429, headers: { 'retry-after': '60' } } }
      }
      return e.send(batch)
    },
  })
  c.updateConfig(config)
  await e.tick()
  const first = c.track('install_click')
  await e.tick()
  const second = c.track('install_click')
  await e.tick()
  assert.equal(e.events.size, 2, 'second click is persisted before the network returns')
  release()
  await Promise.all([first, second])
  await e.tick()
  await c.track('install_click')
  await e.advance(59000)
  assert.equal(count, 1)
  await e.advance(1000)
  assert.equal(count, 2)
  assert.equal(e.events.size, 0)
})

test('a timed-out context handshake can recover on a later registration attempt', async () => {
  const e = environment({ embedded: true })
  const c = createPwaAnalytics(e)
  const first = c.registrationHeaders()
  await e.advance(1000)
  assert.deepEqual(await first, {})
  const second = c.registrationHeaders()
  await e.advance(100)
  e.emit('window', 'message', {
    source: e.parent,
    origin: 'https://shell.test',
    data: {
      type: CONTEXT_RESPONSE,
      context: {
        ...config,
        client_id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        installation_id: null,
        display_mode: 'browser',
        platform: 'ios',
      },
    },
  })
  assert.equal((await second)['X-Pwa-Id'], 56)
})
test('wrong-Origin offline cache and unknown platforms never produce formal events', async () => {
  const e = environment({ standalone: true, offline: true })
  e.storage.set(
    'pwa-statistics-v1:confirmed-config',
    JSON.stringify({
      origin: 'https://other.test',
      config,
      directAllowed: true,
    }),
  )
  const c = createPwaAnalytics(e)
  c.initialize()
  c.markReady()
  await e.advance(1000)
  assert.equal(e.events.size, 0)
  e.nav.onLine = true
  e.nav.userAgent = 'Windows'
  e.nav.platform = 'Win32'
  c.updateConfig(config)
  await c.track('standalone_launch')
  await e.advance(1000)
  assert.equal(e.sent.length, 0)
})

test('Retry-After survives a new client lifecycle sharing the same Origin queue', async () => {
  const e = environment()
  let count = 0
  const send = async (batch) => {
    count++
    if (count === 1) throw { response: { status: 429, headers: { 'retry-after': '60' } } }
    return e.send(batch)
  }
  const first = createPwaAnalytics({ ...e, send })
  first.updateConfig(config)
  await first.track('install_click')
  await e.tick()
  first.stop()
  const second = createPwaAnalytics({ ...e, send })
  second.initialize()
  await e.tick()
  await e.advance(59000)
  assert.equal(count, 1)
  await e.advance(1000)
  assert.equal(count, 2)
  assert.equal(e.events.size, 0)
})

test('navigation dispatch wait resolves before the server acknowledges, without duplicating the event', async () => {
  const e = environment()
  let acknowledge
  const c = createPwaAnalytics({
    ...e,
    send: (batch) =>
      new Promise((resolve) => {
        acknowledge = () =>
          resolve({
            results: batch.map((event) => ({ event_id: event.event_id, status: 'accepted' })),
          })
      }),
  })
  c.updateConfig(config)
  await e.tick()
  let dispatched = false
  const ready = c.track('install_click', { waitForDispatch: true }).then(() => {
    dispatched = true
  })
  await e.tick()
  assert.equal(dispatched, true)
  assert.equal(e.events.size, 1)
  acknowledge()
  await ready
  await c.flush()
  assert.equal(e.events.size, 0)
})
test('onelink skips telemetry and resolves navigation immediately', async () => {
  const e = environment()
  const c = createPwaAnalytics(e)
  c.updateConfig({ ...config, package_mode: 'onelink' })
  await e.tick()
  await c.track('install_click', { waitForDispatch: true })
  assert.equal(e.sent.length, 0)
})
test('ordinary Safari H5 does not add new PWA registration metadata merely from default configuration', async () => {
  const e = environment()
  e.nav.userAgent = 'iPhone'
  e.nav.platform = 'iPhone'
  const c = createPwaAnalytics({ ...e, allowDirect: () => false })
  c.updateConfig(config)
  assert.deepEqual(await c.registrationHeaders(), {})
})

test('explicitly preserved Safari registration adds no new metadata even on a matching PWA configuration', async () => {
  const e = environment()
  e.nav.userAgent = 'iPhone'
  e.nav.platform = 'iPhone'
  const c = createPwaAnalytics(e)
  c.updateConfig(config)
  assert.equal(c.context().platform, 'ios')
  assert.deepEqual(await c.registrationHeaders({ preserveIosBrowser: true }), {})
})
test('preserving Safari registration does not suppress iOS standalone registration context', async () => {
  const e = environment({ standalone: true })
  e.nav.userAgent = 'iPhone'
  e.nav.platform = 'iPhone'
  const c = createPwaAnalytics(e)
  c.updateConfig(config)
  const headers = await c.registrationHeaders({ preserveIosBrowser: true })
  assert.equal(headers['X-Pwa-Platform'], 'ios')
  assert.equal(headers['X-Pwa-Display-Mode'], 'standalone')
  assert.ok(headers['X-Pwa-Installation-Id'])
})

test('HTTP-successful legacy-shaped acknowledgement never discards an unconfirmed event', async () => {
  const e = environment()
  const c = createPwaAnalytics({ ...e, send: async () => undefined })
  c.updateConfig(config)
  await c.track('install_click')
  await e.tick()
  assert.equal(e.events.size, 1)
  const original = [...e.events.values()][0]
  await e.advance(1000)
  assert.deepEqual([...e.events.values()][0], original)
})
