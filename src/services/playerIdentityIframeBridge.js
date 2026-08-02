import { playerIdentityService } from '@/services/playerIdentity'
import {
  createPlayerIdentityHandoffError,
  createPlayerIdentityHandoffResponse,
  parsePlayerIdentityHandoffRequest,
} from '@/shared/auth/playerIdentityMessages'

const pendingRequests = new Map()

function postResponse(iframeWindow, iframeOrigin, response) {
  iframeWindow.postMessage(response, iframeOrigin)
}

export function handlePlayerIdentityIframeMessage({ event, iframeWindow, iframeOrigin }) {
  if (
    !iframeWindow ||
    !iframeOrigin ||
    event.source !== iframeWindow ||
    event.origin !== iframeOrigin
  ) {
    return false
  }

  const request = parsePlayerIdentityHandoffRequest(event.data)
  if (!request) return false
  if (request.targetOrigin !== event.origin || request.targetOrigin !== iframeOrigin) return true

  const requestKey = `${iframeOrigin}:${request.requestId}:${request.state}`
  if (!pendingRequests.has(requestKey)) {
    const responsePromise = playerIdentityService
      .resolveHandoffRequest(request)
      .then((result) => {
        postResponse(iframeWindow, iframeOrigin, createPlayerIdentityHandoffResponse(result))
      })
      .catch((error) => {
        if (error?.navigationStarted) return
        postResponse(iframeWindow, iframeOrigin, createPlayerIdentityHandoffError(request))
      })
      .finally(() => {
        pendingRequests.delete(requestKey)
      })

    pendingRequests.set(requestKey, responsePromise)
  }

  return true
}

export function resetPlayerIdentityIframeBridge() {
  pendingRequests.clear()
}
