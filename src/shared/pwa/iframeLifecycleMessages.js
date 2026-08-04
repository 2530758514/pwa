export const PWA_H5_APP_READY_MESSAGE_TYPE = 'pwa_h5_app_ready'
export const PWA_H5_APP_READY_MESSAGE_VERSION = 1

const APP_READY_FIELDS = new Set(['type', 'version'])

export function isPwaH5AppReadyMessage(data) {
  return Boolean(
    data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      Object.keys(data).length === APP_READY_FIELDS.size &&
      Object.keys(data).every((name) => APP_READY_FIELDS.has(name)) &&
      data.type === PWA_H5_APP_READY_MESSAGE_TYPE &&
      data.version === PWA_H5_APP_READY_MESSAGE_VERSION,
  )
}
