import { buildLandingH5Url } from '@/shared/pwa/landingH5Url'
import { appendStoredPwaFacebookAttributionParams } from '@/shared/analytics/pwaLandingAttribution'
import { appendBigoAttributionParams } from '@/shared/analytics/bigoAttribution'

export function resolveLandingH5Url(url, pwaInfo, isApple) {
  return buildLandingH5Url(url, {
    location: typeof window === 'undefined' ? null : window.location,
    pwaInfo, isApple,
    appendFacebook: appendStoredPwaFacebookAttributionParams,
    appendBigo: appendBigoAttributionParams,
  })
}
