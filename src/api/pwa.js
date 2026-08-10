import http from '@/shared/api/http'
import { appendFrontendOriginHeader } from '@/shared/api/originHeader'

export const pwaApi = {
  getPwaInfo() {
    return http.get('/pwa_h5_detail', {
      headers: appendFrontendOriginHeader({
        lang: 'US',
      }),
    })
  },
  recordAndroidPwaDownloadPageVisit() {
    return http.post(
      '/web_pwa_statistics',
      {
        type: 1,
      },
      {
        headers: {
          'X-Platform': 'android_pwa',
        },
      },
    )
  },
  recordAndroidPwaInstallCompletion() {
    return http.post(
      '/web_pwa_statistics',
      {
        type: 2,
      },
      {
        headers: {
          'X-Platform': 'android_pwa',
        },
      },
    )
  },
  recordAndroidPwaNotificationClick() {
    return http.post(
      '/web_pwa_statistics',
      {
        type: 4,
      },
      {
        headers: {
          'X-Platform': 'android_pwa',
        },
      },
    )
  },
}
