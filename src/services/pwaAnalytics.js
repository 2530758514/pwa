import axios from 'axios'
import { API_BASE_URL } from '@/shared/config/env'
import { createPwaAnalytics } from '@/shared/pwa/statisticsClient'
const transport = axios.create({
  baseURL: API_BASE_URL,
  adapter: 'fetch',
  fetchOptions: { keepalive: true },
  timeout: 10000,
  withCredentials: true,
})
export const pwaAnalytics = createPwaAnalytics({
  send: async (events) => {
    const response = await transport.post(
      '/web_pwa_statistics',
      { schema_version: 1, events },
      {
        headers: { 'X-Origin': window.location.origin },
      },
    )
    if (response.data?.code !== 200) throw new Error('invalid_statistics_response')
    return response.data.data
  },
})
