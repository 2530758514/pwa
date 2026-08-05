export function shouldRenderPwaSurfaceImmediately({
  hasCachedPwaInfo = false,
  hasReturnedInstallHandoff = false,
  hasStandaloneFallback = false,
  isStandalone = false,
  requiresInstallHandoff = false,
} = {}) {
  if (isStandalone && hasStandaloneFallback) return true
  if (!hasCachedPwaInfo) return false
  if (hasReturnedInstallHandoff || isStandalone) return true

  return !requiresInstallHandoff
}
