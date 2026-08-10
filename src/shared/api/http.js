import axios from 'axios'
import { API_BASE_URL } from '@/shared/config/env'
import { appendOsHeader } from '@/shared/api/osHeader'
import { appendBigoAttributionHeaders } from '@/shared/analytics/bigoAttribution'
import { appendFacebookAttributionHeaders } from '@/shared/analytics/facebookAttribution'
import { appendUrlAttributionHeaders } from '@/shared/analytics/urlAttributionHeaders'
import { shouldPreserveFrontendOriginHeader } from '@/shared/api/originHeader'
import { showDebugApiErrorToast } from '@/shared/debug/apiErrorToast'

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const PWA_ID_HEADER_NAME = 'X-Pwa-Id'

const SUCCESS_CODES = new Set([1, 200, 201, 204])
const UNTRUSTED_PROXY_HEADER_NAMES = [
  'Cookie',
  'Set-Cookie',
  'Origin',
  'X-Player-Public-Host',
  'X-Origin',
  'X-Forwarded-Host',
  'Forwarded',
  'agent_id',
  'merchant_id',
  'cookie_scope',
]

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

function rejectWithDebugToast(error) {
  showDebugApiErrorToast(error)
  return Promise.reject(error)
}

function removeHeader(headers, name) {
  if (!headers) return

  if (typeof headers.delete === 'function') {
    headers.delete(name)
    return
  }

  const normalizedName = String(name).toLowerCase()
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === normalizedName) delete headers[key]
  })
}

function stripUntrustedProxyHeaders(headers, config) {
  const preserveFrontendOrigin = shouldPreserveFrontendOriginHeader(config)

  UNTRUSTED_PROXY_HEADER_NAMES.forEach((name) => {
    if (preserveFrontendOrigin && name === 'X-Origin') return
    removeHeader(headers, name)
  })
}

http.interceptors.request.use((config) => {
  config.headers = appendOsHeader(config.headers || {})
  appendFacebookAttributionHeaders(config.headers)
  appendUrlAttributionHeaders(config.headers)
  appendBigoAttributionHeaders(config.headers)
  stripUntrustedProxyHeaders(config.headers, config)

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

    return rejectWithDebugToast(createPayloadError(payload, response))
  },
  (error) => rejectWithDebugToast(createResponseError(error)),
)

export default http
