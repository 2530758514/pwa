import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const shell = source.includes('PWA_SHELL_NOTIFICATION_NAVIGATE')
const origin = 'https://example.test'

function setup({
  userAgent = 'Android',
  result = 'app',
  reject = false,
  cacheFailure = false,
  emptyClients = false,
} = {}) {
  const handlers = new Map()
  const stored = new Map()
  const calls = []
  const messages = []
  const cache = {
    async put(request, response) {
      if (cacheFailure) throw new Error('storage unavailable')
      stored.set(request.url, await response.text())
    },
    async match(request) {
      const value = stored.get(request.url)
      return value ? new Response(value) : undefined
    },
    async delete(request) {
      return stored.delete(request.url)
    },
  }
  function client(name, url = `${origin}/`) {
    return {
      url,
      postMessage(message) {
        messages.push({ name, message })
      },
      async focus() {
        calls.push(`focus:${name}`)
        return this
      },
    }
  }
  const browser = client('browser')
  const app = client('app')
  const context = {
    URL,
    Request,
    Response,
    crypto: { randomUUID: () => `navigation-${messages.length}` },
    caches: { open: async () => cache },
    self: {
      location: { origin, href: `${origin}/sw.js` },
      navigator: userAgent === null ? {} : { userAgent },
      addEventListener: (name, handler) => handlers.set(name, handler),
      clients: {
        async matchAll() {
          calls.push('matchAll')
          return emptyClients ? [] : [browser, app]
        },
        async openWindow(url) {
          calls.push(`open:${url}`)
          if (reject) throw new Error('launch rejected')
          if (result === null) return null
          return result === 'external' ? client('external', 'https://external.test/') : app
        },
      },
    },
  }
  runInNewContext(source, context)
  return {
    calls,
    messages,
    stored,
    context,
    async click(url, action = '', actionRedirects = {}) {
      let completion
      handlers.get('notificationclick')({
        action,
        notification: {
          data: shell ? { redirect: url, actionRedirects } : { url },
          close: () => calls.push('close'),
        },
        waitUntil: (promise) => (completion = promise),
      })
      await completion
    },
  }
}

for (const route of ['/deposit', '/rewards', '/share/invitation', '/account?source=push#details']) {
  test(`Android opens the app entry and hands off ${route}`, async () => {
    const env = setup()
    await env.click(route)
    assert.deepEqual(env.calls, ['close', `open:${origin}/`])
    assert.equal(env.messages[0].name, 'app')
    assert.equal(env.messages[0].message.navigation.url, `${origin}${route}`)
    assert.equal(JSON.parse([...env.stored.values()][0]).url, `${origin}${route}`)
  })
}

test('Android null result preserves cold-start navigation without selecting another window', async () => {
  const env = setup({ result: null })
  await env.click('/deposit')
  assert.deepEqual(env.calls, ['close', `open:${origin}/`])
  assert.equal(env.messages.length, 0)
  assert.equal(env.stored.size, 1)
})

test('Android only falls back to the existing window selection on rejection', async () => {
  const env = setup({ reject: true })
  await env.click('/rewards')
  assert.deepEqual(env.calls, ['close', `open:${origin}/`, 'matchAll', 'focus:browser'])
  assert.equal(env.messages[0].name, 'browser')
})

test('cache failure still delivers navigation to the opened app', async () => {
  const env = setup({ cacheFailure: true })
  await env.click('/account')
  assert.equal(env.messages[0].message.navigation.url, `${origin}/account`)
  assert.equal(env.stored.size, 0)
})

test('an external returned client receives no navigation message', async () => {
  const env = setup({ result: 'external' })
  await env.click('/account')
  assert.equal(env.messages.length, 0)
  assert.equal(env.stored.size, 1)
})

for (const userAgent of ['iPhone', 'iPad', 'Windows', '', null]) {
  test(`${userAgent || 'unknown platform'} retains the existing selection`, async () => {
    const env = setup({ userAgent })
    await env.click('/rewards')
    assert.deepEqual(env.calls, ['close', 'matchAll', 'focus:browser'])
    assert.equal(env.messages[0].message.navigation.url, `${origin}/rewards`)
  })
}

test('cold start retains navigation for the existing consumer', async () => {
  const env = setup({ emptyClients: true, result: null })
  await env.click('/share/invitation?source=push#invite')
  assert.deepEqual(env.calls, ['close', `open:${origin}/`])
  assert.equal(
    JSON.parse([...env.stored.values()][0]).url,
    `${origin}/share/invitation?source=push#invite`,
  )
})

test('iOS without existing windows still opens the original entry', async () => {
  const env = setup({ userAgent: 'iPhone', emptyClients: true })
  await env.click('/deposit')
  assert.deepEqual(env.calls, ['close', 'matchAll', `open:${origin}/`])
})

test('Android launch rejection without existing windows retains the original entry fallback', async () => {
  const env = setup({ reject: true, emptyClients: true })
  await assert.rejects(env.click('/deposit'), /launch rejected/)
  assert.deepEqual(env.calls, ['close', `open:${origin}/`, 'matchAll', `open:${origin}/`])
  assert.equal(env.stored.size, 1)
})

test(
  'shell cold-start consumer confirms only the matching navigation',
  { skip: !shell },
  async () => {
    const env = setup({ result: null })
    await env.click('/deposit')
    const firstId = JSON.parse([...env.stored.values()][0]).id
    // The shell UUID mock depends on message count; model a new UUID for the next click.
    env.context.crypto.randomUUID = () => 'next-click'
    await env.click('/rewards')
    env.context.window = { location: { origin } }
    const consumer = readFileSync(
      new URL('../src/shared/pwa/notificationNavigation.js', import.meta.url),
      'utf8',
    ).replaceAll('export ', '')
    const api = runInNewContext(
      `${consumer}\n({ readPendingNotificationNavigation, clearPendingNotificationNavigation })`,
      { ...env.context, window: { location: { origin }, caches: env.context.caches } },
    )
    assert.equal((await api.readPendingNotificationNavigation()).location, '/rewards')
    assert.equal(await api.clearPendingNotificationNavigation(firstId), false)
    assert.equal(await api.clearPendingNotificationNavigation('next-click'), true)
    assert.equal(env.stored.size, 0)
  },
)

test('consecutive clicks replace pending navigation with distinct IDs', async () => {
  const env = setup()
  await env.click('/deposit')
  await env.click('/rewards')
  const first = env.messages[0].message.navigation
  const second = env.messages[1].message.navigation
  assert.notEqual(first.id, second.id)
  assert.equal(JSON.parse([...env.stored.values()][0]).id, second.id)
})

test(
  'confirmation of an earlier H5 navigation does not clear a later click',
  { skip: shell },
  async () => {
    const env = setup()
    await env.click('/deposit')
    const firstId = env.messages[0].message.navigation.id
    await env.click('/rewards')
    await runInNewContext(`clearNotificationNavigation(${JSON.stringify(firstId)})`, env.context)
    assert.equal(env.stored.size, 1)
    const secondId = env.messages[1].message.navigation.id
    await runInNewContext(`clearNotificationNavigation(${JSON.stringify(secondId)})`, env.context)
    assert.equal(env.stored.size, 0)
  },
)

test('shell notification action retains its configured route', { skip: !shell }, async () => {
  const env = setup()
  await env.click('/account', 'deposit', { deposit: '/deposit?source=action' })
  assert.equal(env.messages[0].message.navigation.url, `${origin}/deposit?source=action`)
})
