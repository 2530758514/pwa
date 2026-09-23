import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATUS_BAR_COLOR = '#000000'

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

test('standalone shell keeps the status bar and manifest surfaces black', () => {
  const indexSource = read('index.html')
  const manifest = JSON.parse(read('public/manifest.webmanifest'))
  const dynamicManifest = JSON.parse(read('public/pwa-dynamic-manifest.webmanifest'))
  const serviceWorkerSource = read('public/sw.js')
  const appSource = read('src/App.vue')
  const manifestSource = read('src/shared/pwa/manifest.js')
  const styleSource = read('src/style.css')
  const iframeShellSource = read('src/components/pwa/PwaIframeShell.vue')

  assert.match(indexSource, /<meta name="theme-color" content="#000000" \/>/)
  assert.match(
    indexSource,
    /<meta name="apple-mobile-web-app-status-bar-style" content="black" \/>/,
  )
  assert.equal(manifest.theme_color, STATUS_BAR_COLOR)
  assert.equal(manifest.background_color, STATUS_BAR_COLOR)
  assert.equal(dynamicManifest.theme_color, STATUS_BAR_COLOR)
  assert.equal(dynamicManifest.background_color, STATUS_BAR_COLOR)
  assert.match(serviceWorkerSource, /theme_color: '#000000'/)
  assert.match(serviceWorkerSource, /background_color: '#000000'/)
  assert.match(appSource, /isShellRuntime\.value \? '#000000' : '#ffffff'/)
  assert.match(manifestSource, /background_color: '#000000'/)
  assert.match(manifestSource, /theme_color: '#000000'/)
  assert.match(styleSource, /html\.is-ios-pwa[\s\S]*background: #000000;/)
  assert.doesNotMatch(iframeShellSource, /background: #272d39;/)
})
