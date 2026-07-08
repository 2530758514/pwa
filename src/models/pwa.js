function normalizePayload(response) {
  if (response?.data && typeof response.data === 'object') {
    return response.data
  }

  return response && typeof response === 'object' ? response : {}
}

function normalizeUrl(value) {
  if (typeof value !== 'string') return ''

  const url = value.trim()
  if (!url) return ''

  if (/^(https?:)?\/\//i.test(url) || url.startsWith('/') || url.startsWith('data:image/')) {
    return url
  }

  return ''
}

function normalizeConfigUrl(value) {
  if (typeof value !== 'string') return ''

  const url = value.trim()
  if (!url || /^(?:javascript|vbscript):/i.test(url)) return ''

  return url
}

function normalizeCarousel(value) {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => normalizeUrl(item))
      .filter(Boolean)
  }

  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') return normalizeUrl(item)
      if (!item || typeof item !== 'object') return ''

      return normalizeUrl(item.url || item.src || item.image || item.image_url || item.imageUrl)
    })
    .filter(Boolean)
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.filter(Boolean)

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeDisplayDate(value) {
  const source = String(value || '').trim()
  if (!source) return ''

  const timestamp = Number(source)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1)).toLocaleDateString('en-US')
  }

  return source
}

function normalizeReviews(value) {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null

      const name = String(item.name || item.nickname || item.user_name || item.userName || '').trim()
      const text = String(item.text || item.content || item.review || '').trim()
      const date = normalizeDisplayDate(item.date || item.created_at || item.createdAt)

      if (!name && !text) return null

      return {
        id: item.id || `${name || 'review'}-${index}`,
        name,
        date,
        text,
      }
    })
    .filter(Boolean)
}

function resolveLanguagePayload(language) {
  if (!Array.isArray(language) || !language.length) return {}

  return language.find((item) => item && typeof item === 'object') || {}
}

export function normalizePwaInfo(response = {}) {
  const payload = normalizePayload(response)
  const languagePayload = resolveLanguagePayload(payload.language)
  const localizedPayload = { ...payload, ...languagePayload }
  const name = String(localizedPayload.store_app_name || localizedPayload.name || payload.pwa_name || '').trim()
  const publisher =
    typeof localizedPayload.store_developer === 'string'
      ? localizedPayload.store_developer.trim()
      : typeof payload.publisher === 'string'
        ? payload.publisher.trim()
        : typeof payload.manufacturer === 'string'
          ? payload.manufacturer.trim()
          : ''
  const logo = normalizeUrl(payload.icon || payload.logo || payload.pwa_logo || payload.pwaLogo)
  const carousel = normalizeCarousel(
    localizedPayload.screenshots || payload.pwa_carousel || payload.pwaCarousel || localizedPayload.images,
  )
  const configUrl = normalizeConfigUrl(
    payload.config_url || payload.configUrl || payload.manifest_url || payload.manifestUrl,
  )
  const comments = Number(payload.comments)
  const updatedDate = normalizeDisplayDate(
    payload.updated_date || payload.updatedDate || payload.updated_on || payload.update_time || payload.create_time,
  )
  const downloadRewardAmount =
    localizedPayload.download_reward_amount ??
    localizedPayload.downloadRewardAmount ??
    payload.download_reward_amount ??
    payload.downloadRewardAmount ??
    ''

  return {
    ...payload,
    name,
    publisher,
    logo,
    pwa_logo: logo,
    pwaLogo: logo,
    pwa_carousel: carousel,
    pwaCarousel: carousel,
    screenshots: carousel,
    downloads: String(localizedPayload.store_downloads || payload.downloads || '').trim(),
    comments: Number.isFinite(comments) ? comments : 0,
    rating: String(
      localizedPayload.store_reviews || payload.rating || payload.store_rating || payload.store_score || '4,9',
    ).trim(),
    updatedDate,
    reviews: normalizeReviews(localizedPayload.reviews || payload.review_list || payload.reviewList),
    introduction: String(localizedPayload.store_description || payload.introduction || '').trim(),
    labels: normalizeTags(localizedPayload.store_tags || payload.label || payload.labels),
    config_url: configUrl,
    configUrl,
    manifestUrl: configUrl,
    h5_url: payload.h5_url || payload.h5Url || '',
    h5Url: payload.h5Url || payload.h5_url || '',
    bottomMenuDefault: payload.bottom_menu_default || payload.bottomMenuDefault || '',
    download_reward_amount: downloadRewardAmount,
    downloadRewardAmount,
    facebook: payload.facebook || null,
    raw: payload,
  }
}
