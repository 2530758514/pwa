import axios from 'axios'
import { API_BASE_URL } from '@/shared/config/env'
import { appendFrontendOriginHeader } from '@/shared/api/originHeader'
import { appendOsHeader } from '@/shared/api/osHeader'
import { appendFacebookAttributionHeaders } from '@/shared/analytics/facebookAttribution'
import { appendUrlAttributionHeaders } from '@/shared/analytics/urlAttributionHeaders'

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const PWA_ID_HEADER_NAME = 'X-Pwa-Id'

const SUCCESS_CODES = new Set([1, 200, 201, 204])

export function setPwaIdRequestHeader(value) {
  const pwaId = value === null || value === undefined ? '' : String(value).trim()

  if (pwaId) {
    http.defaults.headers.common[PWA_ID_HEADER_NAME] = pwaId
    return
  }

  delete http.defaults.headers.common[PWA_ID_HEADER_NAME]
}

function normalizeCode(value) {
  const code = Number(value)
  return Number.isFinite(code) ? code : null
}

function isSuccessCode(value) {
  return SUCCESS_CODES.has(normalizeCode(value))
}

function createPayloadError(payload = {}, response = {}) {
  const responseError = new Error(payload.msg || payload.message || payload.error || 'Request failed')
  responseError.response = response
  responseError.config = response.config
  responseError.code = payload.code

  return responseError
}

function createResponseError(error) {
  const responseError = new Error(error?.response?.data?.msg || error?.message || 'Request failed')
  responseError.cause = error
  responseError.response = error?.response
  responseError.config = error?.config
  responseError.code = error?.response?.data?.code ?? error?.code

  return responseError
}

http.interceptors.request.use((config) => {
  config.headers = appendOsHeader(appendFrontendOriginHeader(config.headers || {}))
  appendFacebookAttributionHeaders(config.headers)
  appendUrlAttributionHeaders(config.headers)

  return config
})

http.interceptors.response.use(
  (response) => {
    const payload = response.data

    if (!payload || typeof payload.code === 'undefined') {
      return payload
    }

    if (isSuccessCode(payload.code)) {
      return payload.data
    }

    return Promise.reject(createPayloadError(payload, response))
  },
  (error) => Promise.reject(createResponseError(error)),
)

export default http
