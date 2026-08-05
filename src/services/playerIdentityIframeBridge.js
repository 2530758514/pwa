import { playerIdentityService } from '@/services/playerIdentity'
import { isPlayerIdentityEnabled } from '@/shared/config/playerIdentity'
import {
  createPlayerIdentityHandoffError,
  createPlayerIdentityHandoffResponse,
  parsePlayerIdentityHandoffConsumed,
  parsePlayerIdentityHandoffRequest,
} from '@/shared/auth/playerIdentityMessages'

const pendingRequests = new Map()

function postResponse(iframeWindow, iframeOrigin, response) {
  iframeWindow.postMessage(response, iframeOrigin)
}

export function handlePlayerIdentityIframeMessage({ event, iframeWindow, iframeOrigin }) {
  if (!isPlayerIdentityEnabled()) return false

  if (
    !iframeWindow ||
    !iframeOrigin ||
    event.source !== iframeWindow ||
    event.origin !== iframeOrigin
  ) {
    return false
  }

  const consumed = parsePlayerIdentityHandoffConsumed(event.data)
  if (consumed) {
    if (consumed.targetOrigin !== event.origin || consumed.targetOrigin !== iframeOrigin) {
      return true
    }
    playerIdentityService.completeInstallHandoff(consumed)
    return true
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

export function completePlayerIdentityInstallHandoffForIframe(iframeOrigin) {
  if (!isPlayerIdentityEnabled()) return false
  return playerIdentityService.completePendingInstallHandoffForTarget(iframeOrigin)
}
