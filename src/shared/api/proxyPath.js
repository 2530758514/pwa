const PRESERVED_API_PATHS = ['/api/player/session', '/api/sse']

export function rewriteApiProxyPath(
  requestPath,
  { proxyPrefix = '/api', rewritePrefix = '', stripPrefix = false } = {},
) {
  const path = String(requestPath || '')
  const mustPreserveApiPrefix = PRESERVED_API_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  )

  if (mustPreserveApiPrefix || (!stripPrefix && !rewritePrefix)) return path

  return path.replace(new RegExp(`^${proxyPrefix}`), rewritePrefix)
}
