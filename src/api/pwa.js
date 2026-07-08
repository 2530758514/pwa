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
}
