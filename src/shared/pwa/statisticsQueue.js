const DATABASE_NAME = 'pwa-statistics-v1'
const STORE_NAME = 'events'

export function createQueue() {
  let opening = null
  async function open() {
    if (opening) return opening
    const pending = new Promise((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => finish(new Error('storage_timeout')), 2000)
      const finish = (error, db) => {
        if (settled) {
          db?.close()
          return
        }
        settled = true
        clearTimeout(timeout)
        if (error) reject(error)
        else {
          db.onversionchange = () => {
            db.close()
            opening = null
          }
          resolve(db)
        }
      }
      let request
      try {
        request = indexedDB.open(DATABASE_NAME, 1)
      } catch (error) {
        finish(error)
        return
      }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'event_id' })
        }
      }
      request.onsuccess = () => finish(null, request.result)
      request.onerror = () => finish(request.error)
      request.onblocked = () => finish(new Error('storage_blocked'))
    })
    opening = pending
    try {
      return await pending
    } catch (error) {
      if (opening === pending) opening = null
      throw error
    }
  }
  async function transaction(mode, operation) {
    const db = await open()
    return new Promise((resolve, reject) => {
      let tx, request
      const timeout = setTimeout(() => {
        try {
          tx?.abort()
        } catch {
          /* An already committed transaction needs no abort. */
        }
        reject(new Error('storage_timeout'))
      }, 2000)
      try {
        tx = db.transaction(STORE_NAME, mode)
        request = operation(tx.objectStore(STORE_NAME))
      } catch (error) {
        clearTimeout(timeout)
        opening = null
        reject(error)
        return
      }
      tx.oncomplete = () => {
        clearTimeout(timeout)
        resolve(request?.result)
      }
      tx.onerror = tx.onabort = () => {
        clearTimeout(timeout)
        reject(tx.error || new Error('storage_aborted'))
      }
    })
  }
  return {
    put: (event) => transaction('readwrite', (store) => store.put(event)),
    all: () => transaction('readonly', (store) => store.getAll()),
    remove: (id) => transaction('readwrite', (store) => store.delete(id)),
  }
}
