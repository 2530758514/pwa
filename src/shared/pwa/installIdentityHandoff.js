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
