import { pwaNotificationsApi } from '@/api/pwaNotifications'
import { normalizeWebPushConfig } from '@/models/pwaNotifications'
import { resolveIsPwaStandalone } from '@/shared/pwa/displayMode'
import { resolvePwaIdentityParams } from '@/shared/pwa/identityParams'

function normalizeSubscription(subscription, config = {}, pwaInfo = {}) {
  if (!subscription || typeof window === 'undefined') return null

  const subscriptionJson = subscription.toJSON()
  const { pwaId, pwaUrlId } = resolvePwaIdentityParams(pwaInfo)
  const payload = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: subscriptionJson.keys || {},
    subscription: subscriptionJson,
    deliveryOwner: 'pwa_shell',
    client: {
      origin: window.location.origin,
      displayMode: resolveIsPwaStandalone() ? 'standalone' : 'browser',
      pwaId,
      pwaUrlId,
    },
  }

  if (config.keyId) {
    payload.keyId = config.keyId
  }

  return payload
}

export const pwaNotificationsService = {
  async getConfig() {
    return normalizeWebPushConfig(await pwaNotificationsApi.getPublicKey())
  },
  subscribe(subscription, config, { pwaInfo } = {}) {
    return pwaNotificationsApi.subscribe(normalizeSubscription(subscription, config, pwaInfo))
  },
}
