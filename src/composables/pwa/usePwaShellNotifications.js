import { computed, readonly, shallowRef } from 'vue'
import { pwaNotificationsService } from '@/services/pwaNotifications'
import { resolveIsPwaStandalone } from '@/shared/pwa/displayMode'

const SERVICE_WORKER_URL = '/sw.js'
const EMPTY_WEB_PUSH_CONFIG = Object.freeze({
  publicKey: '',
  keyId: '',
  enabled: false,
})

const permission = shallowRef(resolveNotificationPermission())
const isSupported = shallowRef(resolvePushSupport())
const isSubscribed = shallowRef(false)
const subscriptionSyncing = shallowRef(false)
const latestNotification = shallowRef(null)
const webPushConfig = shallowRef(EMPTY_WEB_PUSH_CONFIG)
const configLoading = shallowRef(false)
let initialized = false
let configLoaded = false
let configRequest = null
const permissionPromptAttempts = new Set()
let pendingPermissionRequest = null
let notificationPermissionStatus = null
let permissionStateListenersRegistered = false
let serviceWorkerMessageListenerRegistered = false

function isTopLevelWindow() {
  if (typeof window === 'undefined') return false

  try {
    return window.self === window.top
  } catch {
    return false
  }
}

function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false

  return /Android/i.test(`${navigator.userAgent || ''} ${navigator.platform || ''}`)
}

function resolvePushSupport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  return (
    isTopLevelWindow() &&
    isAndroidDevice() &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function resolveNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'

  return Notification.permission || 'default'
}

function encodePublicKey(publicKey) {
  const padding = '='.repeat((4 - (publicKey.length % 4)) % 4)
  const base64 = `${publicKey}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)))
}

async function getServiceWorkerRegistration() {
  if (!resolvePushSupport()) return null

  const currentRegistration = await navigator.serviceWorker.getRegistration('/')
  if (currentRegistration?.active) return currentRegistration
  if (currentRegistration) return navigator.serviceWorker.ready

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' })

  return registration.active ? registration : navigator.serviceWorker.ready
}

async function syncSubscriptionState() {
  isSupported.value = resolvePushSupport()
  permission.value = resolveNotificationPermission()

  if (!isSupported.value) {
    isSubscribed.value = false
    return
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager?.getSubscription()
    isSubscribed.value = Boolean(subscription)
  } catch {
    isSubscribed.value = false
  }
}

async function refreshWebPushConfig({ force = false } = {}) {
  if (!resolvePushSupport()) {
    webPushConfig.value = EMPTY_WEB_PUSH_CONFIG
    return webPushConfig.value
  }

  if (configRequest) return configRequest
  if (configLoaded && !force) return webPushConfig.value

  configLoading.value = true
  configRequest = pwaNotificationsService
    .getConfig()
    .then((config) => {
      webPushConfig.value = config.publicKey ? config : EMPTY_WEB_PUSH_CONFIG
      return webPushConfig.value
    })
    .catch(() => {
      webPushConfig.value = EMPTY_WEB_PUSH_CONFIG
      return webPushConfig.value
    })
    .finally(() => {
      configLoaded = true
      configLoading.value = false
      configRequest = null
    })

  return configRequest
}

function resolvePermissionPromptKey(promptKey) {
  return String(promptKey || 'default').trim() || 'default'
}

function requestSystemPermission({ promptKey, allowStandalone = false } = {}) {
  isSupported.value = resolvePushSupport()
  permission.value = resolveNotificationPermission()

  if (!isSupported.value) return Promise.resolve('unsupported')
  if (permission.value !== 'default') return Promise.resolve(permission.value)
  if (resolveIsPwaStandalone() && !allowStandalone) return Promise.resolve(permission.value)
  if (pendingPermissionRequest) return pendingPermissionRequest
  const resolvedPromptKey = resolvePermissionPromptKey(promptKey)
  if (permissionPromptAttempts.has(resolvedPromptKey)) return Promise.resolve(permission.value)

  permissionPromptAttempts.add(resolvedPromptKey)
  let nativePermissionRequest = null

  try {
    nativePermissionRequest = Notification.requestPermission()
  } catch {
    permission.value = resolveNotificationPermission()
    return Promise.resolve(permission.value)
  }

  // Keep the browser call before the first await so the request remains inside
  // the user's click activation. Reuse the same promise while it is pending.
  pendingPermissionRequest = Promise.resolve(nativePermissionRequest)
    .then((nextPermission) => {
      permission.value = nextPermission || resolveNotificationPermission()
      return permission.value
    })
    .catch(() => {
      permission.value = resolveNotificationPermission()
      return permission.value
    })
    .finally(() => {
      pendingPermissionRequest = null
    })

  return pendingPermissionRequest
}

function requestPermission(options = {}) {
  const permissionRequest = requestSystemPermission(options)

  void permissionRequest.then(() => {
    void syncSubscriptionState()
  })

  return permissionRequest
}

function handleDocumentVisibilityChange() {
  if (document.visibilityState !== 'visible') return

  void syncSubscriptionState()
}

async function registerPermissionStateListeners() {
  if (permissionStateListenersRegistered || !resolvePushSupport()) return

  permissionStateListenersRegistered = true
  window.addEventListener('pageshow', syncSubscriptionState)
  window.addEventListener('focus', syncSubscriptionState)
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)

  if (!navigator.permissions?.query) return

  try {
    notificationPermissionStatus = await navigator.permissions.query({ name: 'notifications' })
    notificationPermissionStatus.addEventListener?.('change', syncSubscriptionState)
  } catch {
    notificationPermissionStatus = null
  }
}

function handleServiceWorkerMessage(event) {
  if (event.data?.type !== 'PWA_SHELL_NOTIFICATION_RECEIVED') return

  latestNotification.value = {
    ...event.data.notification,
    source: event.data.source || 'push',
    receivedAt: Date.now(),
  }
}

function registerServiceWorkerMessageListener() {
  if (
    serviceWorkerMessageListenerRegistered ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return
  }

  navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
  navigator.serviceWorker.addEventListener('controllerchange', syncSubscriptionState)
  serviceWorkerMessageListenerRegistered = true
}

async function requestSubscription({ pwaInfo = {} } = {}) {
  if (subscriptionSyncing.value) return { outcome: 'busy' }

  subscriptionSyncing.value = true
  let subscription = null
  let createdSubscription = false

  try {
    const permissionRequest = requestSystemPermission()
    const nextPermission = await permissionRequest

    if (nextPermission === 'unsupported') return { outcome: 'unsupported' }
    if (nextPermission !== 'granted') {
      return { outcome: 'permission_required', permission: nextPermission }
    }

    await syncSubscriptionState()

    if (!isSupported.value) return { outcome: 'unsupported' }
    const registration = await getServiceWorkerRegistration()
    if (!registration) return { outcome: 'missing_service_worker' }

    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      isSubscribed.value = true
      return { outcome: 'already_subscribed' }
    }

    const config = await refreshWebPushConfig()
    if (!config.enabled || !config.publicKey) return { outcome: 'missing_public_key' }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: encodePublicKey(config.publicKey),
    })
    createdSubscription = true

    try {
      await pwaNotificationsService.subscribe(subscription, config, {
        pwaInfo,
      })
    } catch (error) {
      if (createdSubscription) {
        await subscription.unsubscribe()
      }

      isSubscribed.value = false
      return { outcome: 'failed', error }
    }

    isSubscribed.value = true
    return { outcome: 'subscribed' }
  } catch (error) {
    return { outcome: 'failed', error }
  } finally {
    subscriptionSyncing.value = false
    void syncSubscriptionState()
  }
}

export function usePwaShellNotifications() {
  const isConfigured = computed(() => Boolean(webPushConfig.value.enabled && webPushConfig.value.publicKey))
  const canSubscribe = computed(
    () => isSupported.value && isConfigured.value && permission.value !== 'denied',
  )

  initializePwaShellNotifications()

  return {
    permission: readonly(permission),
    isSupported: readonly(isSupported),
    isSubscribed: readonly(isSubscribed),
    subscriptionSyncing: readonly(subscriptionSyncing),
    latestNotification: readonly(latestNotification),
    webPushConfig: readonly(webPushConfig),
    configLoading: readonly(configLoading),
    isConfigured,
    canSubscribe,
    requestPermission,
    requestSubscription,
    syncSubscriptionState,
    refreshWebPushConfig,
  }
}

export function initializePwaShellNotifications() {
  if (initialized) return

  initialized = true
  void syncSubscriptionState()
  void registerPermissionStateListeners()
  registerServiceWorkerMessageListener()
}
