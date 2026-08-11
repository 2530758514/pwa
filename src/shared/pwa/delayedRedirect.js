function normalizeDueAt(value) {
  const dueAt = Number(value)

  return Number.isFinite(dueAt) && dueAt > 0 ? dueAt : 0
}

export function createDelayedRedirect(options = {}) {
  const {
    delayMs,
    storageKey,
    resolveTargetUrl,
    navigate,
    storage,
    now = () => Date.now(),
    setTimer = (callback, timeout) => setTimeout(callback, timeout),
    clearTimer = (timerId) => clearTimeout(timerId),
  } = options

  let timerId = null
  let dueAt = 0
  let targetUrl = ''

  function clearScheduledTimer() {
    if (timerId !== null) clearTimer(timerId)
    timerId = null
  }

  function removeStoredState() {
    try {
      storage?.removeItem(storageKey)
    } catch {
      // The in-memory state remains authoritative when storage is unavailable.
    }
  }

  function clearPending() {
    clearScheduledTimer()
    dueAt = 0
    targetUrl = ''
    removeStoredState()
  }

  function persistPending() {
    try {
      storage?.setItem(storageKey, JSON.stringify({ dueAt, targetUrl }))
    } catch {
      // The in-memory timer still completes the redirect in this page lifecycle.
    }
  }

  function readPending() {
    try {
      const state = JSON.parse(storage?.getItem(storageKey) || 'null')
      const storedDueAt = normalizeDueAt(state?.dueAt)
      const storedTargetUrl = String(state?.targetUrl || resolveTargetUrl?.() || '').trim()

      if (!storedDueAt || !storedTargetUrl) {
        removeStoredState()
        return null
      }

      return { dueAt: storedDueAt, targetUrl: storedTargetUrl }
    } catch {
      removeStoredState()
      return null
    }
  }

  function runIfDue() {
    if (!dueAt) return false

    const remainingDelay = dueAt - now()
    if (remainingDelay > 0) {
      if (timerId === null) {
        timerId = setTimer(() => {
          timerId = null
          runIfDue()
        }, remainingDelay)
      }

      return false
    }

    const resolvedTargetUrl = targetUrl || String(resolveTargetUrl?.() || '').trim()
    if (!resolvedTargetUrl) return false

    clearPending()
    navigate?.(resolvedTargetUrl)
    return true
  }

  function schedule(scheduleOptions = {}) {
    if (scheduleOptions.preserveExisting === true && dueAt) return true

    const resolvedTargetUrl = String(
      scheduleOptions.targetUrl || resolveTargetUrl?.() || '',
    ).trim()
    if (!resolvedTargetUrl) return false

    const requestedDueAt = normalizeDueAt(scheduleOptions.dueAt)
    dueAt = requestedDueAt || now() + Math.max(0, Number(delayMs) || 0)
    targetUrl = resolvedTargetUrl

    clearScheduledTimer()
    persistPending()
    timerId = setTimer(() => {
      timerId = null
      runIfDue()
    }, Math.max(0, dueAt - now()))

    return true
  }

  function restore(restoreOptions = {}) {
    const pending = readPending()
    if (!pending) return false

    const scheduled = schedule({
      dueAt: restoreOptions.immediate === true ? now() : pending.dueAt,
      targetUrl: pending.targetUrl,
    })

    return restoreOptions.immediate === true ? runIfDue() : scheduled
  }

  return {
    clearPending,
    dispose: clearScheduledTimer,
    restore,
    runIfDue,
    schedule,
  }
}
