import { pwaService } from '@/services/pwa'
import {
  PWA_SHELL_NOTIFICATION_NAVIGATE,
  clearPendingNotificationNavigation,
  normalizeNotificationNavigation,
  readPendingNotificationNavigation,
} from '@/shared/pwa/notificationNavigation'

const RECORDED_CLICK_IDS_STORAGE_KEY = 'pwa_shell_recorded_notification_click_ids'
const MAX_RECORDED_CLICK_IDS = 50

const recordedClickIds = new Set()
let initialized = false

function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false

  return /Android/i.test(`${navigator.userAgent || ''} ${navigator.platform || ''}`)
}

function readRecordedClickIds() {
  if (typeof window === 'undefined') return []

  try {
    const value = JSON.parse(window.localStorage.getItem(RECORDED_CLICK_IDS_STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function claimNotificationClick(navigationId) {
  if (!navigationId || recordedClickIds.has(navigationId)) return false

  const storedIds = readRecordedClickIds()
  if (storedIds.includes(navigationId)) {
    recordedClickIds.add(navigationId)
    return false
  }

  recordedClickIds.add(navigationId)

  try {
    window.localStorage.setItem(
      RECORDED_CLICK_IDS_STORAGE_KEY,
      JSON.stringify([...storedIds, navigationId].slice(-MAX_RECORDED_CLICK_IDS)),
    )
  } catch {
    // The in-memory claim still prevents duplicate calls in this page context.
  }

  return true
}

function recordNotificationClick(navigation) {
  if (!navigation) return

  if (!navigation.location) {
    void clearPendingNotificationNavigation(navigation.id)
  }

  if (!isAndroidDevice() || !claimNotificationClick(navigation.id)) return

  void pwaService
    .getPwaInfo()
    .catch(() => null)
    .then(() => pwaService.recordAndroidPwaNotificationClick())
    .catch(() => null)
}

function handleServiceWorkerMessage(event) {
  if (event.data?.type !== PWA_SHELL_NOTIFICATION_NAVIGATE) return

  recordNotificationClick(normalizeNotificationNavigation(event.data?.navigation))
}

async function recordPendingNotificationClick() {
  recordNotificationClick(await readPendingNotificationNavigation())
}

export function initializePwaNotificationClickTracking() {
  if (
    initialized ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return
  }

  initialized = true
  navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
  void recordPendingNotificationClick()
}
