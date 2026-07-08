import appIcon from '@/assets/pwa/source/app-icon.jpg'
import carouselOne from '@/assets/pwa/source/carousel-1.jpg'
import carouselTwo from '@/assets/pwa/source/carousel-2.jpg'
import carouselThree from '@/assets/pwa/source/carousel-3.jpg'
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
  appIcon,
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

export const DEFAULT_PWA_INFO = {
  name: '1x777slot',
  publisher: '1x777slot',
  logo: appIcon,
  screenshots: [carouselOne, carouselTwo, carouselThree],
  rating: '4,9',
  downloads: '',
  downloadRewardAmount: 20,
  comments: 0,
  introduction:
    'Welcome to our casino slots app. Enjoy a fast install experience, smooth gameplay, daily rewards, and a wide library of social casino games built for mobile play.',
  labels: ['Slots', 'Casino', 'Rewards'],
  updatedDate: '',
  reviews: [
    {
      id: 'default-review-1',
      name: 'Michael',
      date: '06-18-2026',
      text: 'Fast install and smooth gameplay. Rewards are easy to understand and the app opens quickly every time.',
    },
    {
      id: 'default-review-2',
      name: 'Sophia',
      date: '06-12-2026',
      text: 'The interface is clean and the games load without lag. It feels stable on my phone.',
    },
    {
      id: 'default-review-3',
      name: 'Daniel',
      date: '06-03-2026',
      text: 'Good app experience overall. The install process was simple and the daily bonuses are useful.',
    },
  ],
}

export const PWA_METRICS = [
  {
    value: '4,9',
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
