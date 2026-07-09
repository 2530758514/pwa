export const PWA_ID_PARAM = 'pwa_id'
export const PWA_URL_ID_PARAM = 'pwa_url_id'
export const PWA_APP_OPEN_PARAM = 'pwa_app'
export const PWA_APP_OPEN_VALUE = '1'

function normalizePwaIdentityParam(value) {
  if (value === null || value === undefined) return ''

  return String(value).trim()
}

function pickFirstPwaIdentityParam(...values) {
  for (const value of values) {
    const normalizedValue = normalizePwaIdentityParam(value)

    if (normalizedValue) return normalizedValue
  }

  return ''
}

export function resolvePwaIdentityParams(pwaInfo = {}) {
  return {
    pwaId: pickFirstPwaIdentityParam(pwaInfo.pwa_id, pwaInfo.pwaId, pwaInfo.id),
    pwaUrlId: pickFirstPwaIdentityParam(pwaInfo.pwa_url_id, pwaInfo.pwaUrlId),
  }
}

export function applyPwaIdentityParams(targetParams, pwaInfo = {}) {
  if (!targetParams) return

  const { pwaId, pwaUrlId } = resolvePwaIdentityParams(pwaInfo)

  if (pwaId) targetParams.set(PWA_ID_PARAM, pwaId)
  if (pwaUrlId) targetParams.set(PWA_URL_ID_PARAM, pwaUrlId)
}

export function applyPwaAppOpenParam(targetParams) {
  if (!targetParams) return

  targetParams.set(PWA_APP_OPEN_PARAM, PWA_APP_OPEN_VALUE)
}
