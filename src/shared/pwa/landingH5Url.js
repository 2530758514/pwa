import { applyPwaIdentityParams } from './identityParams.js'

const DIRECT_H5_BLOCKED_PARAM_NAMES = new Set([
  'client_id',
  'code',
  'code_challenge',
  'code_challenge_method',
  'code_verifier',
  'exchange_code',
  'grant',
  'handoff_action',
  'handoff_grant',
  'handoff_id',
  'provision_code',
  'pwa_app',
  'pwa_launch',
  'pwa_launch_time',
  'request_id',
  'source_client_id',
  'state',
  'target_client_id',
  'token',
])

function appendSearchParams(targetParams, sourceParams) {
  sourceParams.forEach((value, key) => {
    if (!key || targetParams.has(key) || DIRECT_H5_BLOCKED_PARAM_NAMES.has(key.toLowerCase())) {
      return
    }

    targetParams.append(key, value)
  })
}

function removeBlockedDirectH5Params(targetParams) {
  Array.from(targetParams.keys()).forEach((key) => {
    if (DIRECT_H5_BLOCKED_PARAM_NAMES.has(key.toLowerCase())) {
      targetParams.delete(key)
    }
  })
}

export function buildLandingH5Url(url, { location, pwaInfo = {}, isApple = false,
  appendFacebook = () => {}, appendBigo = () => {} } = {}) {
  if (!location) return url
  try {
    const targetUrl = new URL(url, location.origin)
    removeBlockedDirectH5Params(targetUrl.searchParams)
    appendFacebook(targetUrl.searchParams)
    appendSearchParams(targetUrl.searchParams, new URLSearchParams(location.search))
    const hashQueryIndex = location.hash.indexOf('?')
    if (hashQueryIndex !== -1) {
      appendSearchParams(targetUrl.searchParams, new URLSearchParams(location.hash.slice(hashQueryIndex + 1)))
    }
    applyPwaIdentityParams(targetUrl.searchParams, pwaInfo)
    appendBigo(targetUrl.searchParams)
    if (isApple) targetUrl.searchParams.set('pwa_ios_h5_redirect', '1')
    return targetUrl.toString()
  } catch {
    return url
  }
}
