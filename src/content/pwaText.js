const PWA_TEXT = {
  pwaPage: {
    hero: {
      verified: 'Verified by Play Protect',
      scanQr: 'Scan the QR code to download',
    },
    metrics: {
      reviews: 'reviews',
      downloads: 'Downloads',
      featured: 'Featured',
    },
    actions: {
      share: 'Share',
      wishlist: 'Add To Wishlist',
    },
    install: {
      install: 'Install',
      mainCta: 'Rapid Install',
      playNow: 'Play',
      safe: 'Download within 10 seconds',
      installing: 'Opening secure install',
      installingProgress: 'Installing...',
      installProgressMeta: '{percent}% (Total 1M)',
      installed: 'Added to home screen',
      accepted: 'Installation started',
      ready: 'Install is ready. Tap Rapid Install again.',
      secureRequired: 'Open this page over HTTPS or Android localhost, then try again.',
      promptUnavailable: 'Open this page in Chrome and try again from the browser menu.',
    },
    about: {
      title: 'About this App',
      updatedOn: 'Updated on',
    },
    safety: {
      title: 'Data safety',
      description:
        'Safety starts with understanding how developers collect and share your data. Data privacy and security practices may vary based on your use, region and age. The developer provided this information and may update it over time.',
      seeDetails: 'See details',
    },
    ratings: {
      title: 'Ratings and reviews',
      verified: 'Ratings and reviews are verified',
      phone: 'Phone',
      tablet: 'Tablet',
      helpful: 'Did you find this helpful?',
      yes: 'Yes',
      no: 'No',
    },
    nav: {
      games: 'Games',
      apps: 'Apps',
      films: 'Films',
      books: 'Books',
      children: 'Children',
    },
    footer: {
      googlePlay: 'Google Play',
      applyPlay: 'Apply Play',
      playPass: 'Play Pass',
      playPoints: 'Play Points',
      giftCards: 'Gift cards',
      redeem: 'Redeem',
      refundPolicy: 'Refund policy',
      childrenFamily: 'Children and family',
      parentGuide: 'Parent guide',
      familySharing: 'Family sharing',
      terms: 'Terms of service',
      privacy: 'Privacy',
      about: 'About Apply Play',
      developers: 'Developers',
      store: 'Apply Store',
    },
    installedOpen: {
      title: 'App installed',
      description:
        '{app} has been added to your home screen. Open the app or continue on the web.',
      open: 'Open App',
      web: 'Open Web Page',
      close: 'Close open app popup',
    },
    browserGuide: {
      title: 'Hint',
      chrome: 'Chrome',
      safari: 'Safari',
      stepOpenPrefix: '1. Open ',
      stepOpenSuffix: ' to install.',
      openBrowser: 'Open {browser}',
      stepCopyPrefix: '2. If you cannot open ',
      stepCopySuffix: ' directly, copy the address below and open it in ',
      copy: 'Copy',
      copySuccess: 'Copy Success',
      copyFailed: 'Copy failed',
      close: 'Close browser guide',
    },
    iframe: {
      loading: 'Opening app...',
      missingUrl: 'App address is unavailable. Please refresh and try again.',
      reload: 'Reload',
    },
  },
}

function readPath(path) {
  return String(path || '')
    .split('.')
    .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), PWA_TEXT)
}

export function t(path, params = {}) {
  const template = readPath(path)
  const text = typeof template === 'string' ? template : path

  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}
