import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldRenderPwaSurfaceImmediately } from '../src/shared/pwa/pwaStartupPolicy.js'

test('renders cached detail immediately after auth callback and in installed PWA', () => {
  assert.equal(
    shouldRenderPwaSurfaceImmediately({
      hasCachedPwaInfo: true,
      hasReturnedInstallHandoff: true,
      requiresInstallHandoff: true,
    }),
    true,
  )
  assert.equal(
    shouldRenderPwaSurfaceImmediately({
      hasCachedPwaInfo: true,
      isStandalone: true,
      requiresInstallHandoff: true,
    }),
    true,
  )
  assert.equal(
    shouldRenderPwaSurfaceImmediately({
      hasCachedPwaInfo: false,
      hasStandaloneFallback: true,
      isStandalone: true,
    }),
    true,
  )
})

test('waits for fresh detail before the initial Android install handoff', () => {
  assert.equal(
    shouldRenderPwaSurfaceImmediately({
      hasCachedPwaInfo: true,
      requiresInstallHandoff: true,
    }),
    false,
  )
  assert.equal(
    shouldRenderPwaSurfaceImmediately({
      hasCachedPwaInfo: false,
      requiresInstallHandoff: false,
    }),
    false,
  )
})
