import axios from 'axios'
import { appendBigoAttributionHeaders } from '@/shared/analytics/bigoAttribution'
import { appendFacebookAttributionHeaders } from '@/shared/analytics/facebookAttribution'
import { appendOsHeader } from '@/shared/api/osHeader'
import { API_BASE_URL } from '@/shared/config/env'
import { resolvePwaIdentityParams } from '@/shared/pwa/identityParams'

const playerSessionHttp = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: (status) => status >= 200 && status < 600,
})

function normalizeResponse(response) {
  return {
    status: Number(response?.status || 0),
    body: response?.data ?? null,
    headers: response?.headers || {},
  }
}

function createRegistrationHeaders(pwaInfo = {}) {
  const facebookHeaders = appendFacebookAttributionHeaders({})
  const bigoHeaders = appendBigoAttributionHeaders({})
  const { pwaId, pwaUrlId } = resolvePwaIdentityParams(pwaInfo)
  const headers = {}

  if (facebookHeaders.fbclid) headers.fbclid = facebookHeaders.fbclid
  if (bigoHeaders['X-Bigo-Click-Id']) {
    headers['X-Bigo-Click-Id'] = bigoHeaders['X-Bigo-Click-Id']
  }
  if (pwaId) headers['X-Pwa-Id'] = pwaId
  if (pwaUrlId) headers['X-Pwa-Url-Id'] = pwaUrlId

  return appendOsHeader(headers)
}

async function post(path, body = {}, config = {}) {
  return normalizeResponse(await playerSessionHttp.post(path, body, config))
}

export const playerSessionApi = {
  bootstrap() {
    return post('/player/session/bootstrap')
  },

  register({ invite = 0, pwaInfo = {} } = {}) {
    return post(
      '/player/session/register',
      { invite: invite || 0 },
      { headers: createRegistrationHeaders(pwaInfo) },
    )
  },
}

export { playerSessionHttp }
