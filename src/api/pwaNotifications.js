import http from '@/shared/api/http'

export const pwaNotificationsApi = {
  getPublicKey() {
    return http.get('/web_push_public_key', {
      headers: {
        lang: 'US',
      },
    })
  },
  subscribe(payload) {
    return http.post('/web_push_subscribe', payload, {
      headers: {
        'X-Platform': 'android_pwa',
      },
    })
  },
}
