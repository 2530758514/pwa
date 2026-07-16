function unwrapPayload(response) {
  if (typeof response === 'string') return { publicKey: response }
  if (!response || typeof response !== 'object') return {}

  if (response.data && typeof response.data === 'object') return response.data

  return response
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false

  return fallback
}

/**
 * Keep the public-key response flexible at the API boundary. The push runtime
 * consumes this stable shape and never depends on a build-time VAPID value.
 */
export function normalizeWebPushConfig(response) {
  const payload = unwrapPayload(response)
  const publicKey = normalizeString(
    payload.public_key ||
      payload.publicKey ||
      payload.vapid_public_key ||
      payload.vapidPublicKey ||
      payload.web_push_public_key ||
      payload.webPushPublicKey,
  )
  const keyId = normalizeString(
    payload.key_id ||
      payload.keyId ||
      payload.key_version ||
      payload.keyVersion ||
      payload.version,
  )
  const enabled = normalizeBoolean(
    payload.enabled ?? payload.enable ?? payload.is_enabled ?? payload.isEnabled,
    Boolean(publicKey),
  )

  return {
    publicKey,
    keyId,
    enabled,
  }
}
