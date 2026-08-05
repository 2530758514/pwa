import assert from 'node:assert/strict'
import test from 'node:test'
import { dismissBootstrapLoading } from '../src/shared/ui/bootstrapLoading.js'

function createLoadingElement() {
  const classes = new Set()
  let removed = false

  return {
    dataset: {},
    classList: { add: (value) => classes.add(value) },
    addEventListener() {},
    removeEventListener() {},
    remove() {
      removed = true
    },
    hasClass(value) {
      return classes.has(value)
    },
    wasRemoved() {
      return removed
    },
  }
}

test('keeps the original bootstrap node and fades it before removal', () => {
  const element = createLoadingElement()
  const documentObject = { getElementById: () => element }
  const windowObject = {
    matchMedia: () => ({ matches: false }),
    setTimeout: () => 1,
    clearTimeout() {},
  }

  assert.equal(dismissBootstrapLoading({ documentObject, windowObject }), true)
  assert.equal(element.hasClass('identity-first-paint--leaving'), true)
  assert.equal(element.wasRemoved(), false)
  assert.equal(dismissBootstrapLoading({ documentObject, windowObject }), false)
})

test('removes the bootstrap node immediately inside the H5 iframe', () => {
  const element = createLoadingElement()

  assert.equal(
    dismissBootstrapLoading({
      documentObject: { getElementById: () => element },
      windowObject: {},
      immediate: true,
    }),
    true,
  )
  assert.equal(element.wasRemoved(), true)
})
