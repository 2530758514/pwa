function getLocalStorage() {
  if (typeof localStorage === 'undefined') return null

  return localStorage
}

export const storage = {
  get(key, fallback = null) {
    const store = getLocalStorage()
    if (!store) return fallback

    const rawValue = store.getItem(key)

    if (rawValue === null) return fallback

    try {
      return JSON.parse(rawValue)
    } catch {
      return rawValue
    }
  },

  set(key, value) {
    const store = getLocalStorage()
    if (!store) return

    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value)
    store.setItem(key, serializedValue)
  },

  remove(key) {
    const store = getLocalStorage()
    if (!store) return

    store.removeItem(key)
  },
}
