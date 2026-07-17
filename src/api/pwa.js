import http from '@/shared/api/http'
import { getAttributionSafePageUrl } from '@/shared/analytics/attributionReporting'
import { FRONTEND_ORIGIN_HEADER } from '@/shared/api/originHeader'

export const pwaApi = {
  getPwaInfo() {
    return http.get('/pwa_h5_detail', {
      headers: {
        [FRONTEND_ORIGIN_HEADER]: getAttributionSafePageUrl(),
      },
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
}
