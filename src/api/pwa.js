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
}
