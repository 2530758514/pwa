const ANDROID_PATTERN = /Android/i
const FACEBOOK_IN_APP_BROWSER_PATTERN = /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i

function readNavigatorValue(name) {
  if (typeof navigator === 'undefined') return ''
  return String(navigator[name] || '')
}

export function isAndroidInstallIdentityHandoffRuntime({
  userAgent = readNavigatorValue('userAgent'),
  platform = readNavigatorValue('platform'),
} = {}) {
  const browserIdentity = `${userAgent} ${platform}`

  return (
    ANDROID_PATTERN.test(browserIdentity) &&
    !FACEBOOK_IN_APP_BROWSER_PATTERN.test(browserIdentity)
  )
}

export function isAndroidFacebookInAppBrowserRuntime({
  userAgent = readNavigatorValue('userAgent'),
  platform = readNavigatorValue('platform'),
} = {}) {
  const browserIdentity = `${userAgent} ${platform}`

  return (
    ANDROID_PATTERN.test(browserIdentity) &&
    FACEBOOK_IN_APP_BROWSER_PATTERN.test(browserIdentity)
  )
}

export function resolvePwaH5IdentityOrigin(
  pwaInfo = {},
  { baseOrigin = '', fallbackUrl = '' } = {},
) {
  const sourceUrl = String(
    pwaInfo?.h5_url || pwaInfo?.h5Url || fallbackUrl || '',
  ).trim()

  if (!sourceUrl) return ''

  try {
    const fallbackOrigin =
      baseOrigin || (typeof window === 'undefined' ? '' : window.location.origin)
    return new URL(sourceUrl, fallbackOrigin).origin
  } catch {
    return ''
  }
}

function normalizeExactOrigin(value) {
  const origin = String(value || '').trim()

  try {
    return new URL(origin).origin === origin ? origin : ''
  } catch {
    return ''
  }
}

export function resolveInstallIdentityTargetOrigin({
  pending = null,
  acquired = null,
  completed = null,
} = {}) {
  // A completed handoff is the durable account binding for an installed app.
  // Do not let a later detail response or an interrupted new landing flow move
  // a cold start to another H5 storage partition.
  for (const record of [completed, pending, acquired]) {
    const targetOrigin = normalizeExactOrigin(record?.targetOrigin)
    if (targetOrigin) return targetOrigin
  }

  return ''
}

export function pinInstallIdentityUrlToOrigin(
  sourceUrl,
  { targetOrigin = '', baseOrigin = '' } = {},
) {
  const normalizedTargetOrigin = normalizeExactOrigin(targetOrigin)
  if (!normalizedTargetOrigin) return String(sourceUrl || '').trim()

  try {
    const fallbackOrigin =
      baseOrigin || (typeof window === 'undefined' ? '' : window.location.origin)
    const resolvedSourceUrl = new URL(sourceUrl, fallbackOrigin)
    const resolvedTargetOrigin = new URL(normalizedTargetOrigin)

    resolvedSourceUrl.protocol = resolvedTargetOrigin.protocol
    resolvedSourceUrl.host = resolvedTargetOrigin.host
    resolvedSourceUrl.username = ''
    resolvedSourceUrl.password = ''

    return resolvedSourceUrl.toString()
  } catch {
    return ''
  }
}
