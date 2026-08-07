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
    removeStoredState()
  }

  function persistPending() {
    try {
      storage?.setItem(storageKey, JSON.stringify({ dueAt }))
    } catch {
      // The in-memory timer still completes the redirect in this page lifecycle.
    }
  }

  function readPending() {
    try {
      const state = JSON.parse(storage?.getItem(storageKey) || 'null')
      const storedDueAt = normalizeDueAt(state?.dueAt)

      if (!storedDueAt) removeStoredState()

      return storedDueAt
    } catch {
      removeStoredState()
      return 0
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

    const targetUrl = String(resolveTargetUrl?.() || '').trim()
    if (!targetUrl) return false

    clearPending()
    navigate?.(targetUrl)
    return true
  }

  function schedule(scheduleOptions = {}) {
    const targetUrl = String(resolveTargetUrl?.() || '').trim()
    if (!targetUrl) return false

    const requestedDueAt = normalizeDueAt(scheduleOptions.dueAt)
    dueAt = requestedDueAt || now() + Math.max(0, Number(delayMs) || 0)

    clearScheduledTimer()
    persistPending()
    timerId = setTimer(() => {
      timerId = null
      runIfDue()
    }, Math.max(0, dueAt - now()))

    return true
  }

  function restore() {
    const storedDueAt = readPending()
    if (!storedDueAt) return false

    return schedule({ dueAt: storedDueAt })
  }

  return {
    clearPending,
    dispose: clearScheduledTimer,
    restore,
    runIfDue,
    schedule,
  }
}
