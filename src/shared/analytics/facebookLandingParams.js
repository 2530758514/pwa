const URL_ATTRIBUTION_PARAM_ALIASES = [
  'fbclid',
  'pixelId',
  'x-fbc',
  'x_fbc',
  'fbc',
  '_fbc',
  'x-fbp',
  'x_fbp',
  'fbp',
  '_fbp',
  'event_source_url',
  'eventSourceUrl',
]

function hasValue(value) {
  const normalized = String(value ?? '').trim()

  return Boolean(normalized && normalized !== 'null' && normalized !== 'undefined')
}

function resolveLocation() {
  if (typeof window === 'undefined') return { search: '', hash: '' }

  return window.location || { search: '', hash: '' }
}

// Landing UI must inspect this navigation only, never persisted attribution.
export function hasFacebookUrlAttribution(location = resolveLocation()) {
  const search = new URLSearchParams(location?.search || '')
  const hash = String(location?.hash || '')
  const hashQueryIndex = hash.indexOf('?')
  const hashParams = hashQueryIndex === -1 ? null : new URLSearchParams(hash.slice(hashQueryIndex + 1))

  return URL_ATTRIBUTION_PARAM_ALIASES.some(
    (name) => hasValue(search.get(name)) || hasValue(hashParams?.get(name)),
  )
}
