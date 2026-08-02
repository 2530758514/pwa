const IFRAME_FACEBOOK_ATTRIBUTION_FIELDS = Object.freeze([
  ['fbclid', ['fbclid'], 512],
  ['x-fbc', ['fbc', 'x-fbc'], 1024],
  ['x-fbp', ['fbp', 'x-fbp'], 1024],
  ['event_source_url', ['event_source_url'], 2048],
])

function normalizeAttributionValue(value, maxLength) {
  const normalized = String(value ?? '').trim()

  if (
    !normalized ||
    normalized === 'null' ||
    normalized === 'undefined' ||
    normalized.length > maxLength
  ) {
    return ''
  }

  return normalized
}

function resolveAttributionValue(attribution, names, maxLength) {
  for (const name of names) {
    const value = normalizeAttributionValue(attribution?.[name], maxLength)

    if (value) return value
  }

  return ''
}

export function appendFacebookAttributionParams(targetParams, attribution = {}) {
  if (!targetParams || typeof targetParams.set !== 'function') return targetParams

  for (const [paramName, attributionNames, maxLength] of IFRAME_FACEBOOK_ATTRIBUTION_FIELDS) {
    const value = resolveAttributionValue(attribution, attributionNames, maxLength)

    if (value) targetParams.set(paramName, value)
  }

  return targetParams
}
