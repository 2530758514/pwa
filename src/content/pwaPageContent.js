import featuredTypeIcon from '@/assets/pwa/source/featured-type.png'
import googlePlayLogo from '@/assets/pwa/source/google-play-logo.svg'
import rapidIcon from '@/assets/pwa/source/rapid.png'
import scanAngle from '@/assets/pwa/source/scan-angle.png'
import scanLine from '@/assets/pwa/source/scan-line.png'
import scanPhone from '@/assets/pwa/source/scan-phone.png'
import shieldIcon from '@/assets/pwa/source/shield.png'
import topDeveloper from '@/assets/pwa/source/top-developer.png'
import verifiedIcon from '@/assets/pwa/source/verified.png'

export const SOURCE_DOWNLOAD_URL = 'https://xxx4.1x777slot.com/appp/777slot777.apk'

export const PWA_SOURCE_ASSETS = {
  featuredTypeIcon,
  googlePlayLogo,
  rapidIcon,
  scanAngle,
  scanLine,
  scanPhone,
  shieldIcon,
  topDeveloper,
  verifiedIcon,
}

export const PWA_METRICS = [
  {
    value: '',
    valueKey: 'rating',
    labelKey: 'pwaPage.metrics.reviews',
    icon: 'star',
    subValueKey: 'comments',
  },
  {
    value: '',
    valueKey: 'downloads',
    labelKey: 'pwaPage.metrics.downloads',
  },
  {
    value: '',
    labelKey: 'pwaPage.metrics.featured',
    icon: 'featured',
    image: featuredTypeIcon,
  },
]

export const PWA_SAFETY_ITEMS = [
  {
    title: 'This app may share these data types with third parties',
    subtitle: 'Device or other IDs',
    icon: 'share',
  },
  {
    title: 'This app may collect these data types',
    subtitle: 'App activity, app info, performance, and device IDs',
    icon: 'upload',
  },
  {
    title: 'Data is encrypted in transit',
    icon: 'lock',
  },
]

export const PWA_RATING_BARS = [
  { stars: 5, percent: 97 },
  { stars: 4, percent: 1 },
  { stars: 3, percent: 1 },
  { stars: 2, percent: 1 },
  { stars: 1, percent: 0 },
]

export const PWA_FOOTER_LINKS = [
  'pwaPage.footer.applyPlay',
  'pwaPage.footer.playPass',
  'pwaPage.footer.playPoints',
  'pwaPage.footer.giftCards',
  'pwaPage.footer.redeem',
  'pwaPage.footer.refundPolicy',
]

export const PWA_FAMILY_LINKS = [
  'pwaPage.footer.childrenFamily',
  'pwaPage.footer.parentGuide',
  'pwaPage.footer.familySharing',
]
