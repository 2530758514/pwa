import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initializePwaInstallPromptListeners } from './composables/pwa/usePwaInstallPrompt'
import { initializePwaShellNotifications } from './composables/pwa/usePwaShellNotifications'
import {
  captureBigoAttribution,
  getStoredBigoPixelId,
} from './shared/analytics/bigoAttribution'
import bigoPixelManager from './shared/analytics/bigoPixel'
import { initializePwaDisplayModeClasses } from './shared/pwa/displayMode'
import { applyStoredPwaManifestUrl } from './shared/pwa/manifest'
import { initializePwaNotificationClickTracking } from './services/pwaNotificationClickTracking'

const shouldEnableVConsole =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_VCONSOLE === 'true'

if (shouldEnableVConsole) {
  import('vconsole')
    .then(({ default: VConsole }) => {
      new VConsole()
    })
    .catch(() => {})
}

const bigoAttribution = captureBigoAttribution()
bigoPixelManager.init({ pixelId: bigoAttribution?.pixelId || getStoredBigoPixelId() })
initializePwaDisplayModeClasses()
applyStoredPwaManifestUrl()
initializePwaInstallPromptListeners()
initializePwaShellNotifications()
initializePwaNotificationClickTracking()

const canUseServiceWorker =
  'serviceWorker' in navigator && (window.isSecureContext || import.meta.env.PROD)
const shouldDisableServiceWorker = import.meta.env.VITE_ENABLE_PWA_SW === 'false'
const shouldRegisterServiceWorker =
  canUseServiceWorker && !shouldDisableServiceWorker
const shouldClearDevServiceWorker =
  'serviceWorker' in navigator &&
  import.meta.env.DEV &&
  shouldDisableServiceWorker

if (shouldRegisterServiceWorker) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  navigator.serviceWorker.addEventListener('controllerchange', applyStoredPwaManifestUrl)
} else if (shouldClearDevServiceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister()
        })
      })
      .catch(() => {})
  })
}

createApp(App).mount('#app')
