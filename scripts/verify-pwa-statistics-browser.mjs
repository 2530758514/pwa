import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const state = {
  mode: 'pwa_first',
  pwa: 56,
  delay: 0,
  fail: false,
  requests: [],
  accepted: new Map(),
  registrations: [],
  preflights: 0,
}
const config = () => ({
  package_mode: state.mode,
  pwa_id: state.pwa,
  pwa_url_id: 12,
})
let pwaOrigin, h5Origin
const clientCode = await readFile(
  new URL('../src/shared/pwa/statisticsClient.js', import.meta.url),
  'utf8',
)
const queueCode = await readFile(
  new URL('../src/shared/pwa/statisticsQueue.js', import.meta.url),
  'utf8',
)
function page(mode) {
  return `<!doctype html><meta charset="utf-8"><button id="install">Install</button><script type="module">
import { createPwaAnalytics, CONTEXT_REQUEST, CONTEXT_RESPONSE } from '/client.js';
const client = window.client = createPwaAnalytics({ send: async events => {
 const response = await fetch('/web_pwa_statistics', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Origin': location.origin }, body: JSON.stringify({ schema_version: 1, events }) });
 if (!response.ok) throw { response: { status: response.status, headers: {} } };
 return (await response.json()).data;
} });
client.initialize(); client.markReady();
document.querySelector('#install').onclick = () => { void client.track('install_click') };
${
  mode === 'child'
    ? `
try {
 const headers = await client.registrationHeaders();
 const response = await fetch('${pwaOrigin}/web_refresh_register', { credentials: 'include', headers: { ...headers, 'X-Origin': location.origin } });
 window.registration = { ok: response.ok, headers };
} catch { window.registration = { ok: false } }
`
    : `
fetch('/detail').then(r => r.json()).then(info => { client.updateConfig(info); window.configured = true });
${
  mode === 'bridge'
    ? `
const frame = document.createElement('iframe'); frame.id = 'business'; frame.referrerPolicy = 'origin';
frame.src = '${h5Origin}/child'; document.body.append(frame);
window.addEventListener('message', async event => {
 if (event.source !== frame.contentWindow || event.origin !== '${h5Origin}' || event.data?.type !== CONTEXT_REQUEST) return;
 const context = await client.waitForContext();
 event.source.postMessage({ type: CONTEXT_RESPONSE, context }, '${h5Origin}');
});
`
    : ''
}
`
}
window.runtimeReady = true;
</script>`
}
function server() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local')
    const origin = req.headers.origin
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    if (req.method === 'OPTIONS') {
      state.preflights++
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || '*',
      )
      res.statusCode = 204
      res.end()
      return
    }
    if (url.pathname === '/client.js' || url.pathname === '/statisticsQueue.js') {
      res.setHeader('Content-Type', 'text/javascript')
      res.end(url.pathname === '/client.js' ? clientCode : queueCode)
      return
    }
    if (url.pathname === '/detail') {
      const snapshot = config()
      await new Promise((resolve) => setTimeout(resolve, state.delay))
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(snapshot))
      return
    }
    if (url.pathname === '/web_refresh_register') {
      state.registrations.push(req.headers)
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ code: 200, data: { user_id: 1 } }))
      return
    }
    if (url.pathname === '/web_pwa_statistics') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks))
      assert.equal(body.schema_version, 1)
      assert.ok(!('type' in body))
      assert.ok(body.events.length <= 20)
      assert.ok(Buffer.byteLength(JSON.stringify(body)) <= 16384)
      state.requests.push(body.events)
      if (state.fail) {
        res.statusCode = 503
        res.end('{}')
        return
      }
      const results = body.events.map((event) => {
        const duplicate = state.accepted.has(event.event_id)
        state.accepted.set(event.event_id, event)
        return {
          event_id: event.event_id,
          status: duplicate ? 'duplicate' : 'accepted',
          reason: null,
        }
      })
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ code: 200, data: { results } }))
      return
    }
    res.setHeader('Content-Type', 'text/html')
    res.end(
      page(url.pathname === '/child' ? 'child' : url.pathname === '/bridge' ? 'bridge' : 'plain'),
    )
  })
}
const pwaServer = server(),
  h5Server = server()
await Promise.all([
  new Promise((resolve) => pwaServer.listen(0, '127.0.0.1', resolve)),
  new Promise((resolve) => h5Server.listen(0, '127.0.0.1', resolve)),
])
pwaOrigin = `http://127.0.0.1:${pwaServer.address().port}`
h5Origin = `http://127.0.0.1:${h5Server.address().port}`
const results = []
let browser, viteServer, h5ViteServer
try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/145.0.0.0 Mobile Safari/537.36',
  })
  await context.addInitScript(() => {
    if (location.pathname === '/native' || location.pathname === '/bridge') {
      const original = window.matchMedia.bind(window)
      window.matchMedia = (query) =>
        query === '(display-mode: standalone)'
          ? { matches: true, addEventListener() {}, removeEventListener() {} }
          : original(query)
    }
  })
  const tab = await context.newPage()
  const errors = []
  tab.on('pageerror', (error) => errors.push(error.message))
  // Native IndexedDB survives a complete document reload while a server outage is in progress.
  state.fail = true
  await tab.goto(pwaOrigin)
  await tab.waitForFunction(() => window.configured)
  await tab.click('#install')
  await tab.waitForFunction(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('pwa-statistics-v1', 1)
      r.onsuccess = () => resolve(r.result)
    })
    return await new Promise((resolve) => {
      const r = db.transaction('events').objectStore('events').count()
      r.onsuccess = () => {
        db.close()
        resolve(r.result === 1)
      }
    })
  })
  const storedId = state.requests.flat()[0]?.event_id
  await tab.reload()
  await tab.waitForFunction(() => window.configured)
  state.fail = false
  await tab.evaluate(() => window.client.flush())
  await tab.waitForFunction(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('pwa-statistics-v1', 1)
      r.onsuccess = () => resolve(r.result)
    })
    return await new Promise((resolve) => {
      const r = db.transaction('events').objectStore('events').count()
      r.onsuccess = () => {
        db.close()
        resolve(r.result === 0)
      }
    })
  })
  assert.equal(state.accepted.size, 1)
  if (storedId) assert.ok(state.accepted.has(storedId))
  results.push('IndexedDB persisted click across full reload and drained after a 503 outage')
  // Native launches have stable installation IDs, but distinct launch/event IDs per full load.
  await tab.goto(pwaOrigin + '/native')
  await tab.waitForFunction(() => window.configured)
  await tab.evaluate(() => window.client.flush())
  await tab.waitForTimeout(100)
  const first = [...state.accepted.values()].filter((e) => e.event_name === 'standalone_launch')[0]
  assert.ok(first)
  await tab.reload()
  await tab.waitForFunction(() => window.configured)
  await tab.evaluate(() => window.client.flush())
  await tab.waitForTimeout(100)
  const launches = [...state.accepted.values()].filter((e) => e.event_name === 'standalone_launch')
  assert.equal(launches.length, 2)
  assert.equal(launches[0].installation_id, launches[1].installation_id)
  assert.notEqual(launches[0].launch_id, launches[1].launch_id)
  state.mode = 'onelink'
  await tab.reload()
  await tab.waitForFunction(() => window.configured)
  await tab.waitForTimeout(100)
  assert.equal(
    [...state.accepted.values()].filter((e) => e.event_name === 'standalone_launch').length,
    2,
  )
  state.mode = 'pwa_first'
  state.pwa = 99
  await tab.reload()
  await tab.waitForFunction(() => window.configured)
  await tab.evaluate(() => window.client.flush())
  await tab.waitForTimeout(100)
  const changed = [...state.accepted.values()].filter((e) => e.event_name === 'standalone_launch')
  assert.equal(changed.length, 3)
  assert.equal(changed[2].pwa_id, 99)
  results.push(
    'Standalone simulation: distinct reload launches, stable installation ID, fresh config attribution, onelink suppression',
  )
  // Real cross-origin iframe postMessage and browser CORS preflight, with delayed fresh metadata.
  state.pwa = 56
  state.delay = 200
  await tab.goto(pwaOrigin + '/bridge')
  await tab.waitForFunction(() => !!document.querySelector('iframe'))
  const frame = await (await tab.$('iframe')).contentFrame()
  await frame.waitForFunction(() => window.registration?.ok)
  const registration = state.registrations.at(-1)
  assert.equal(registration['x-pwa-id'], '56')
  assert.equal(registration['x-pwa-platform'], 'android')
  assert.equal(registration['x-origin'], h5Origin)
  assert.equal(registration['x-pwa-source-origin'], pwaOrigin)
  assert.equal(registration['x-pwa-display-mode'], 'standalone')
  assert.match(registration['x-pwa-installation-id'], /^[0-9a-f-]{36}$/)
  assert.ok(state.preflights > 0)
  const before = state.accepted.size
  await frame.click('#install')
  await frame.evaluate(() => window.client.flush())
  await tab.waitForTimeout(100)
  assert.equal(state.accepted.size, before, 'iframe never duplicates parent direct events')
  results.push(
    'Cross-origin iframe received fresh parent context before registration; correct Origin headers; CORS preflight succeeded; iframe did not duplicate events',
  )
  assert.deepEqual(errors, [])
  await context.close()
  // Exercise the actual Vue shell, not just the protocol harness.
  process.env.VITE_ENABLE_TETRIS_LANDING = 'false'
  process.env.VITE_PLAYER_IDENTITY_ENABLED = 'false'
  process.env.VITE_PLAYER_SESSION_ENABLED = 'false'
  process.env.VITE_API_BASE_URL = '/api'
  const { createServer: createViteServer } = await import('vite')
  viteServer = await createViteServer({
    server: { host: '127.0.0.1', port: 0 },
  })
  await viteServer.listen()
  const appOrigin = `http://127.0.0.1:${viteServer.httpServer.address().port}`
  const uiContext = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 375, height: 812 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/145.0.0.0 Mobile Safari/537.36',
  })
  const uiPage = await uiContext.newPage()
  const uiEvents = new Map(),
    uiErrors = []
  let detailRequests = 0
  let uiPwa = 56,
    holdDetails = false
  const releaseDetails = []
  uiPage.on('pageerror', (error) => uiErrors.push(error.message))
  uiPage.on('console', (message) => {
    if (message.type() === 'error') console.log('UI console:', message.text().slice(0, 500))
  })
  uiPage.on('requestfailed', (request) =>
    console.log('UI request failed:', request.url(), request.failure()?.errorText),
  )
  uiPage.on('response', (response) => {
    if (response.status() >= 400) console.log('UI response:', response.status(), response.url())
  })
  const mockUiApi = async (route) => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }
    let data = {}
    if (url.pathname.endsWith('/pwa_h5_detail')) {
      detailRequests++
      if (holdDetails) await new Promise((resolve) => releaseDetails.push(resolve))
      data = {
        package_mode: 'pwa_first',
        pwa_id: uiPwa,
        id: uiPwa,
        pwa_url_id: 12,
        pwa_url: appOrigin,
        h5_url: h5Origin,
        name: 'Statistics UI Check',
        pwa_name: 'Statistics UI Check',
      }
    } else if (url.pathname.endsWith('/web_pwa_statistics')) {
      const body = route.request().postDataJSON()
      assert.equal(body.schema_version, 1)
      assert.ok(!('type' in body))
      data = {
        results: body.events.map((event) => {
          const duplicate = uiEvents.has(event.event_id)
          uiEvents.set(event.event_id, event)
          return {
            event_id: event.event_id,
            status: duplicate ? 'duplicate' : 'accepted',
            reason: null,
          }
        }),
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, data }),
    })
  }
  await uiPage.route('**/api/**', mockUiApi)
  const waitFor = async (condition) => {
    for (let i = 0; i < 100; i++) {
      if (condition()) return
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert.fail('Timed out waiting for shell analytics')
  }
  await uiPage.goto(appOrigin)
  await uiPage
    .locator('[data-pwa-install-action]')
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(async (error) => {
      console.log(
        JSON.stringify({
          uiErrors,
          body: (await uiPage.locator('body').innerText()).slice(0, 1500),
          detailRequests,
          url: uiPage.url(),
        }),
      )
      throw error
    })
  await waitFor(() => [...uiEvents.values()].some((event) => event.event_name === 'landing_view'))
  assert.equal(
    [...uiEvents.values()].filter((event) => event.event_name === 'landing_view').length,
    1,
  )
  await uiPage.locator('[data-pwa-install-action]').click()
  await waitFor(() => [...uiEvents.values()].some((event) => event.event_name === 'install_click'))
  assert.equal(
    [...uiEvents.values()].filter((event) => event.event_name === 'install_click').length,
    1,
  )
  assert.equal(
    [...uiEvents.values()].filter((event) => event.event_name === 'landing_view').length,
    1,
  )
  assert.ok(detailRequests >= 1)
  const visitsBeforeReload = [...uiEvents.values()].filter(
    (event) => event.event_name === 'landing_view',
  ).length
  holdDetails = true
  uiPwa = 99
  await uiPage.reload({ waitUntil: 'domcontentloaded' })
  await uiPage.locator('[data-pwa-install-action]').waitFor({ state: 'visible' })
  await waitFor(() => releaseDetails.length > 0)
  await uiPage.waitForTimeout(150)
  assert.equal(
    [...uiEvents.values()].filter((event) => event.event_name === 'landing_view').length,
    visitsBeforeReload,
    'cached first paint cannot report a fresh visit before current metadata succeeds',
  )
  holdDetails = false
  for (const release of releaseDetails.splice(0)) release()
  await waitFor(
    () =>
      [...uiEvents.values()].filter((event) => event.event_name === 'landing_view').length ===
      visitsBeforeReload + 1,
  )
  const latestVisit = [...uiEvents.values()]
    .filter((event) => event.event_name === 'landing_view')
    .at(-1)
  assert.equal(latestVisit.pwa_id, 99)
  assert.deepEqual(uiErrors, [])
  await uiContext.close()
  const safariContext = await browser.newContext({
    serviceWorkers: 'block',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  })
  const safariPage = await safariContext.newPage()
  await safariPage.route('**/api/**', mockUiApi)
  await safariPage.goto(appOrigin + '/?fbclid=isolated-ad-click&campaign=verification')
  await safariPage.locator('[data-pwa-install-action]').waitFor({ state: 'visible' })
  await waitFor(() =>
    [...uiEvents.values()].some(
      (event) => event.platform === 'ios' && event.event_name === 'landing_view',
    ),
  )
  await safariPage.locator('[data-pwa-install-action]').click()
  await waitFor(() =>
    [...uiEvents.values()].some(
      (event) => event.platform === 'ios' && event.event_name === 'install_click',
    ),
  )
  assert.equal(
    [...uiEvents.values()].filter(
      (event) => event.platform === 'ios' && event.event_name === 'install_click',
    ).length,
    1,
  )
  await safariPage.waitForURL((url) => url.origin === h5Origin)
  const redirectedUrl = new URL(safariPage.url())
  assert.equal(redirectedUrl.searchParams.get('fbclid'), 'isolated-ad-click')
  assert.equal(redirectedUrl.searchParams.get('campaign'), 'verification')
  assert.equal(redirectedUrl.searchParams.get('pwa_id'), '99')
  assert.equal(redirectedUrl.searchParams.get('pwa_url_id'), '12')
  assert.equal(redirectedUrl.searchParams.get('pwa_ios_h5_redirect'), '1')
  await safariContext.close()
  results.push(
    'Actual iOS landing flow: one visit and install click survived navigation to H5; original advertising parameters, PWA IDs and redirect marker preserved',
  )
  await viteServer.close()
  viteServer = null
  results.push(
    'Actual Vue shell: one first-screen visit and trusted install click; cached UI waits for fresh metadata and reports the new PWA ID; no browser startup or Vue errors',
  )

  // Actual H5 services in a Safari standalone simulation. Every business request is mocked.
  const fixtureModule = `
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import { pwaService } from '@/services/pwa';
import { pwaAnalytics, configurePwaAnalytics } from '@/services/pwaAnalytics';
setActivePinia(createPinia());
useAuthStore().setWebCreateToken('isolated-test-token');
useUserStore().setUser({ id: 42 });
configurePwaAnalytics({ package_mode: 'pwa_first', pwa_id: 19, pwa_url_id: 141, pwa_url: 'pwa02.draft7bk.uk' });
pwaAnalytics.markReady();
const grants = await Promise.all([
 pwaService.claimPwaDownloadAwardOnceOnPwaOpen(), pwaService.claimPwaDownloadAwardOnceOnPwaOpen()
]);
await pwaService.claimPwaDownloadAwardOnceOnPwaOpen();
window.h5Verification = { grants, complete: true };
window.h5Analytics = pwaAnalytics;
window.h5Service = pwaService;
window.h5User = useUserStore();
`
  const previousDirectory = process.cwd()
  const h5Root = new URL('../../h5slot/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  process.chdir(h5Root)
  process.env.VITE_USE_MOCK = 'false'
  h5ViteServer = await createViteServer({
    root: h5Root,
    logLevel: 'error',
    optimizeDeps: { entries: ['src/services/pwa.js', 'src/services/pwaAnalytics.js'] },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'isolated-statistics-verification',
        resolveId(id) {
          if (id === 'virtual:pwa-statistics-h5-fixture')
            return '\0virtual:pwa-statistics-h5-fixture'
        },
        load(id) {
          if (id === '\0virtual:pwa-statistics-h5-fixture') return fixtureModule
        },
        configureServer(server) {
          server.middlewares.use('/__statistics_fixture', (_req, res) => {
            res.setHeader('Content-Type', 'text/html')
            res.end(
              '<!doctype html><div id="app"></div><script type="module" src="/@id/__x00__virtual:pwa-statistics-h5-fixture"></script>',
            )
          })
        },
      },
    ],
  })
  await h5ViteServer.listen()
  const h5AppOrigin = `http://127.0.0.1:${h5ViteServer.httpServer.address().port}`
  const nativeContext = await browser.newContext({
    serviceWorkers: 'block',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  })
  await nativeContext.addInitScript(() =>
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }),
  )
  const h5Page = await nativeContext.newPage()
  const h5Errors = [],
    nativeEvents = new Map(),
    rewardCalls = []
  let statisticsUnavailable = true,
    awardUnavailable = false
  h5Page.on('pageerror', (error) => h5Errors.push(error.message))
  const mockH5Api = async (route) => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) {
      await route.continue()
      return
    }
    let data = {},
      status = 200
    if (path.endsWith('/web_pwa_statistics')) {
      if (statisticsUnavailable) status = 503
      else {
        const body = route.request().postDataJSON()
        data = {
          results: body.events.map((event) => {
            const duplicate = nativeEvents.has(event.event_id)
            nativeEvents.set(event.event_id, event)
            return {
              event_id: event.event_id,
              status: duplicate ? 'duplicate' : 'accepted',
              reason: null,
            }
          }),
        }
      }
    } else if (path.endsWith('/web_activity_download_award')) {
      rewardCalls.push(path)
      if (awardUnavailable) status = 503
      else data = { reward: 20, status: 'claimed' }
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ code: status, data, msg: status === 200 ? 'Success' : 'Unavailable' }),
    })
  }
  await h5Page.route('**/api/**', mockH5Api)
  await h5Page.goto(h5AppOrigin + '/__statistics_fixture')
  await h5Page
    .waitForFunction(() => window.h5Verification?.complete, null, { timeout: 10000 })
    .catch(async (error) => {
      console.log(
        JSON.stringify({
          h5Errors,
          body: (await h5Page.locator('body').innerText()).slice(0, 500),
        }),
      )
      throw error
    })
  assert.equal(
    rewardCalls.length,
    1,
    'statistics outage does not block or duplicate the real reward service',
  )
  assert.equal((await h5Page.evaluate(() => window.h5Verification.grants)).length, 2)
  statisticsUnavailable = false
  await h5Page.evaluate(() => window.h5Analytics.flush())
  await waitFor(() => nativeEvents.size === 1)
  const nativeLaunch = [...nativeEvents.values()][0]
  assert.equal(nativeLaunch.platform, 'ios')
  assert.equal(nativeLaunch.display_mode, 'standalone')
  assert.equal(nativeLaunch.event_name, 'standalone_launch')
  assert.ok(nativeLaunch.installation_id)
  awardUnavailable = true
  const outcome = await h5Page.evaluate(async () => {
    window.h5User.setUser({ id: 43 })
    try {
      await window.h5Service.claimPwaDownloadAwardOnceOnPwaOpen()
      return { failed: false }
    } catch {
      return { failed: true, claimed: window.h5Service.hasClaimedPwaDownloadAwardForCurrentUser() }
    }
  })
  assert.deepEqual(outcome, { failed: true, claimed: false })
  assert.equal(rewardCalls.length, 2, 'failed reward is not automatically replayed')
  assert.deepEqual(h5Errors, [])
  await nativeContext.close()
  const ordinaryContext = await browser.newContext({
    serviceWorkers: 'block',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  })
  const ordinaryPage = await ordinaryContext.newPage()
  await ordinaryPage.route('**/api/**', mockH5Api)
  await ordinaryPage.goto(h5AppOrigin + '/__statistics_fixture')
  await ordinaryPage.waitForFunction(() => window.h5Verification?.complete)
  const beforeOrdinary = nativeEvents.size
  await ordinaryPage.evaluate(() => window.h5Analytics.track('install_click'))
  const oldRegistrationHeaders = await ordinaryPage.evaluate(() =>
    window.h5Analytics.registrationHeaders({ preserveIosBrowser: true }),
  )
  assert.deepEqual(oldRegistrationHeaders, {})
  assert.equal(
    nativeEvents.size,
    beforeOrdinary,
    'bare foreign PWA domain cannot make ordinary H5 own PWA events',
  )
  assert.equal(rewardCalls.length, 2, 'ordinary Safari H5 does not claim the startup reward')
  await ordinaryContext.close()
  results.push(
    'Actual H5 with live-shaped bare-domain metadata: ordinary Safari does not emit PWA events, add registration metadata, or claim startup rewards',
  )
  await h5ViteServer.close()
  h5ViteServer = null
  process.chdir(previousDirectory)
  results.push(
    'Actual H5 services in iOS standalone simulation: launch reported by H5; statistics 503 did not block one-time reward; failed award was not marked or replayed',
  )

  await mkdir(new URL('../output/playwright/', import.meta.url), {
    recursive: true,
  })
  await writeFile(
    new URL('../output/playwright/pwa-statistics-results.json', import.meta.url),
    JSON.stringify(
      {
        passed: true,
        results,
        limitations: [
          'Local mock API only; standalone mode simulated; no real registration or monetary requests',
        ],
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify({ passed: true, results }, null, 2))
} finally {
  await browser?.close()
  await viteServer?.close()
  await h5ViteServer?.close()
  await Promise.all([
    new Promise((resolve) => pwaServer.close(resolve)),
    new Promise((resolve) => h5Server.close(resolve)),
  ])
}
