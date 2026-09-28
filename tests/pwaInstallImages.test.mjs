import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { normalizePwaInfo } from '../src/models/pwa.js'

const readJson = async (relativePath) => {
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
  return JSON.parse(source)
}

test('normalizes system detail carousel images for landing-page display data', () => {
  const pwaInfo = normalizePwaInfo({
    data: {
      pwa_carousel: [
        {
          image_url: 'https://cdn.example.com/install-1.png',
          width: 488,
          height: 1055,
          type: 'image/png',
        },
      ],
    },
  })

  assert.deepEqual(pwaInfo.screenshots, [
    {
      src: 'https://cdn.example.com/install-1.png',
      sizes: '488x1055',
      type: 'image/png',
      form_factor: 'narrow',
    },
  ])
})

test('static install manifests advertise the four local PNG screenshots', async () => {
  const [manifest, dynamicManifest] = await Promise.all([
    readJson('public/manifest.webmanifest'),
    readJson('public/pwa-dynamic-manifest.webmanifest'),
  ])

  const expectedSources = [1, 2, 3, 4].map((index) => `/pwa-source/${index}.png`)

  assert.deepEqual(
    manifest.screenshots.map((screenshot) => screenshot.src),
    expectedSources,
  )
  assert.deepEqual(
    dynamicManifest.screenshots.map((screenshot) => screenshot.src),
    expectedSources,
  )
  assert.equal(
    manifest.screenshots.every(
      (screenshot) =>
        screenshot.sizes === '488x1055' &&
        screenshot.type === 'image/png' &&
        screenshot.form_factor === 'narrow',
    ),
    true,
  )
})

test('runtime manifest always uses local screenshots instead of interface screenshots', async () => {
  const [manifestSource, serviceWorkerSource] = await Promise.all([
    readFile(new URL('../src/shared/pwa/manifest.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/sw.js', import.meta.url), 'utf8'),
  ])

  assert.match(manifestSource, /prepareRicherInstallScreenshots\(DEFAULT_INSTALL_SCREENSHOTS\)/)
  assert.match(manifestSource, /src: `\/pwa-source\/\$\{index\}\.png`/)
  assert.match(serviceWorkerSource, /src: `\/pwa-source\/\$\{index\}\.png`/)
  assert.doesNotMatch(manifestSource, /prepareRicherInstallScreenshots\(manifest\.screenshots\)/)
})
