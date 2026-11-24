import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { webcrypto } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
const defaultDetail = {
  package_mode: 'pwa_first', pwa_id: 56, pwa_url_id: 12,
  h5_url: 'https://h5.test/game?from=backend#/home',
}
const response = (data, status = 200) => new Response(JSON.stringify(data), { status })

function setup({ href = 'https://entry.test/', detail = defaultDetail, detailFetch,
  statisticsFetch, storageFailure = false, userAgent = 'Android' } = {}) {
  const requests = [], navigations = [], timers = new Map(), events = new Map(), stored = new Map()
  const nodes = new Map()
  let timerId = 0
  const elements = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: id === 'failure', setAttribute() {},
      addEventListener(name, callback) { this[name] = callback } })
    return nodes.get(id)
  }
  const window = {
    location: { href, origin: new URL(href).origin, replace: url => navigations.push(url) },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
  }
  window.parent = window
  const fetch = async (url, options) => {
    requests.push({ url, ...options })
    if (url === '/api/pwa_h5_detail') {
      return detailFetch ? detailFetch(options) : response({ code: 200, data: detail })
    }
    assert.equal(url, '/api/web_pwa_statistics')
    const body = JSON.parse(options.body)
    if (statisticsFetch) return statisticsFetch(body, options)
    return response({ code: 200, data: { results: body.events.map(event => ({ event_id: event.event_id, status: 'accepted' })) } })
  }
  const context = {
    window, location: window.location, fetch, URL, URLSearchParams, Headers, AbortController,
    navigator: { userAgent, platform: '', maxTouchPoints: 0, onLine: true },
    document: { getElementById: elements, visibilityState: 'visible', referrer: '',
      addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    crypto: webcrypto, TextEncoder,
    setTimeout: (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId },
    clearTimeout: id => timers.delete(id), setInterval() {}, clearInterval() {},
    createQueue: () => ({
      put: async event => { if (storageFailure) throw new Error('storage_blocked'); events.set(event.event_id, event) },
      all: async () => [...events.values()], remove: async id => events.delete(id),
    }),
  }
  // Execute the actual embedded client; replace only the browser storage adapter.
  runInNewContext(script.replace('function createQueue()', 'function browserCreateQueue()'), context)
  const settle = async () => { for (let i = 0; i < 100; i++) await Promise.resolve() }
  return {
    requests, navigations, nodes, events, settle,
    statistics: () => requests.filter(item => item.url === '/api/web_pwa_statistics'),
    async fire(ms) {
      const pending = [...timers].filter(([, timer]) => timer.ms === ms)
      assert.ok(pending.length, `expected a ${ms}ms timer`)
      for (const [id, timer] of pending) { timers.delete(id); timer.callback() }
      await settle()
    },
  }
}

test('single HTML embeds exactly the current shared statistics code', () => {
  execFileSync(process.execPath, [new URL('../scripts/sync-standalone-statistics.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '--check'])
  assert.doesNotMatch(html, /<script[^>]+src=|serviceWorker\.register|fbq\(|bigo\./)
})

test('forwards query/hash parameters unchanged with duplicates, empty values and target route', async () => {
  const app = setup({ href: 'https://entry.test/?a=one&a=two&empty=&fbclid=x%2By&token=t#/route?a=hash&b=z',
    detail: { ...defaultDetail, h5_url: 'https://h5.test/game?a=target&keep=yes#/home' } })
  await app.settle()
  assert.equal(app.navigations.length, 1)
  const target = new URL(app.navigations[0])
  assert.deepEqual(target.searchParams.getAll('a'), ['one', 'two'])
  assert.equal(target.searchParams.get('empty'), '')
  assert.equal(target.searchParams.get('fbclid'), 'x+y')
  assert.equal(target.searchParams.get('token'), 't')
  assert.equal(target.searchParams.get('b'), 'z')
  assert.equal(target.searchParams.get('keep'), 'yes')
  assert.equal(target.hash, '#/home')
  const headers = app.requests.find(r => r.url === '/api/pwa_h5_detail').headers
  assert.equal(headers.get('X-Origin'), 'https://entry.test')
  assert.equal(headers.get('X-Os'), 'web')
  assert.equal(headers.get('lang'), 'US')
  assert.equal(headers.get('token'), null)
})

test('one V1 landing visit uses confirmed IDs, never URL IDs, without install or launch events', async () => {
  const app = setup({ href: 'https://entry.test/?pwa_id=999&pwa_url_id=888' })
  await app.settle()
  assert.equal(app.statistics().length, 1)
  const request = app.statistics()[0]
  const body = JSON.parse(request.body)
  assert.equal(body.schema_version, 1)
  assert.equal(body.events.length, 1)
  const event = body.events[0]
  assert.equal(event.event_name, 'landing_view')
  assert.equal(event.pwa_id, 56)
  assert.equal(event.pwa_url_id, 12)
  assert.equal(event.platform, 'android')
  assert.equal(event.display_mode, 'browser')
  assert.equal(event.installation_id, null)
  assert.equal(request.headers['X-Origin'], 'https://entry.test')
  assert.equal(request.keepalive, true)
  assert.equal(app.navigations.length, 1)
})

test('does not wait for a statistics server response before redirecting', async () => {
  const app = setup({ statisticsFetch: () => new Promise(() => {}) })
  await app.settle()
  assert.equal(app.statistics().length, 1)
  assert.equal(app.navigations.length, 1)
})

test('blocked persistence cannot delay H5 beyond the 200ms deadline', async () => {
  const app = setup({ storageFailure: true })
  await app.settle()
  assert.equal(app.navigations.length, 0)
  await app.fire(200)
  assert.equal(app.navigations.length, 1)
  assert.equal(app.statistics().length, 0)
})

for (const [name, detail, userAgent] of [
  ['onelink', { ...defaultDetail, package_mode: 'onelink' }, 'Android'],
  ['missing binding', { h5_url: defaultDetail.h5_url }, 'Android'],
  ['unknown device', defaultDetail, 'Desktop'],
]) {
  test(`${name} redirects without fabricating a visit or waiting for the deadline`, async () => {
    const app = setup({ detail, userAgent })
    await app.settle()
    assert.equal(app.navigations.length, 1)
    assert.equal(app.statistics().length, 0)
  })
}

test('transient detail failures retry twice and report only one visit on success', async () => {
  let count = 0
  const app = setup({ detailFetch: () => ++count < 3 ? response({}, 503) : response({ code: 200, data: defaultDetail }) })
  await app.settle()
  await app.fire(1000)
  await app.fire(3000)
  assert.equal(count, 3)
  assert.equal(app.navigations.length, 1)
  assert.equal(app.statistics().length, 1)
})

test('statistics retry retains the event ID and never retries the navigation', async () => {
  let count = 0
  const app = setup({ statisticsFetch: body => ++count === 1 ? response({}, 503)
    : response({ code: 200, data: { results: body.events.map(event => ({ event_id: event.event_id, status: 'accepted' })) } }) })
  await app.settle()
  await app.fire(1000)
  assert.equal(app.statistics().length, 2)
  assert.equal(JSON.parse(app.statistics()[0].body).events[0].event_id, JSON.parse(app.statistics()[1].body).events[0].event_id)
  assert.equal(app.navigations.length, 1)
})

for (const target of ['', 'javascript:alert(1)', '/relative', 'https://entry.test/']) {
  test(`invalid H5 target ${target || '(empty)'} shows Retry without navigation or formal event`, async () => {
    const app = setup({ detail: { ...defaultDetail, h5_url: target } })
    await app.settle()
    assert.equal(app.navigations.length, 0)
    assert.equal(app.statistics().length, 0)
    assert.equal(app.nodes.get('failure').hidden, false)
  })
}

test('manual retry after business failure preserves entry parameters and counts once', async () => {
  let count = 0
  const app = setup({ href: 'https://entry.test/?fbclid=original', detailFetch: () => response(++count === 1
    ? { code: 422, msg: 'not ready' } : { code: 200, data: defaultDetail }) })
  await app.settle()
  assert.equal(app.nodes.get('failure').hidden, false)
  app.nodes.get('retry').click()
  await app.settle()
  assert.equal(new URL(app.navigations[0]).searchParams.get('fbclid'), 'original')
  assert.equal(app.statistics().length, 1)
  app.nodes.get('retry').click()
  await app.settle()
  assert.equal(app.navigations.length, 1)
})

test('detail timeout exhausts two automatic retries and exposes manual Retry', async () => {
  const app = setup({ detailFetch: options => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')))
  }) })
  await app.settle()
  await app.fire(10000)
  await app.fire(1000)
  await app.fire(10000)
  await app.fire(3000)
  await app.fire(10000)
  assert.equal(app.requests.filter(r => r.url === '/api/pwa_h5_detail').length, 3)
  assert.equal(app.nodes.get('failure').hidden, false)
  assert.equal(app.navigations.length, 0)
})
