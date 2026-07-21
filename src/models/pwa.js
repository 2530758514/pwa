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

function normalizeQueryValue(value) {
  if (value === null || value === undefined) return ''

  return String(value).trim()
}

function pickFirstQueryValue(...values) {
  for (const value of values) {
    const normalizedValue = normalizeQueryValue(value)

    if (normalizedValue) return normalizedValue
  }

  return ''
}

function normalizeCarouselItems(value) {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return Array.isArray(value) ? value : []
}

function pickCarouselSource(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
    if (Array.isArray(value) && value.length) return value
  }

  return []
}

function normalizeCarousel(value) {
  return normalizeCarouselItems(value)
    .map((item) => {
      if (typeof item === 'string') return normalizeUrl(item)
      if (!item || typeof item !== 'object') return ''

      return normalizeUrl(item.url || item.src || item.image || item.image_url || item.imageUrl)
    })
    .filter(Boolean)
}

function normalizeScreenshotSizes(item = {}) {
  const sizes = String(item.sizes || item.size || '').trim()
  if (sizes) return sizes

  const width = Number(item.width || item.image_width || item.imageWidth)
  const height = Number(item.height || item.image_height || item.imageHeight)

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }

  return `${Math.round(width)}x${Math.round(height)}`
}

function normalizeManifestScreenshots(value) {
  return normalizeCarouselItems(value)
    .map((item) => {
      const src =
        typeof item === 'string'
          ? normalizeUrl(item)
          : normalizeUrl(item?.url || item?.src || item?.image || item?.image_url || item?.imageUrl)

      if (!src) return null

      if (typeof item === 'string') {
        return {
          src,
          form_factor: 'narrow',
        }
      }

      const sizes = normalizeScreenshotSizes(item)
      const type = String(item.type || item.mime_type || item.mimeType || '').trim()
      const formFactor = String(item.form_factor || item.formFactor || 'narrow').trim()
      const label = String(item.label || item.title || '').trim()

      return {
        src,
        ...(sizes ? { sizes } : {}),
        ...(type ? { type } : {}),
        form_factor: formFactor || 'narrow',
        ...(label ? { label } : {}),
      }
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
  const pwaName = String(payload.pwa_name || payload.pwaName || '').trim()
  const name = String(localizedPayload.store_app_name || localizedPayload.name || pwaName || '').trim()
  const installName = pwaName || name
  const publisher =
    typeof localizedPayload.store_developer === 'string'
      ? localizedPayload.store_developer.trim()
      : typeof payload.publisher === 'string'
        ? payload.publisher.trim()
        : typeof payload.manufacturer === 'string'
          ? payload.manufacturer.trim()
          : ''
  const logo = normalizeUrl(payload.icon || payload.logo || payload.pwa_logo || payload.pwaLogo)
  const carouselSource = pickCarouselSource(
    localizedPayload.screenshots,
    payload.pwa_carousel,
    payload.pwaCarousel,
    localizedPayload.images,
  )
  const carousel = normalizeCarousel(carouselSource)
  const manifestScreenshots = normalizeManifestScreenshots(carouselSource)
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
  const pwaId = pickFirstQueryValue(payload.id, payload.pwa_id, payload.pwaId)
  const pwaUrlId = pickFirstQueryValue(payload.pwa_url_id, payload.pwaUrlId)

  return {
    ...payload,
    pwa_id: pwaId,
    pwaId,
    pwa_url_id: pwaUrlId,
    pwaUrlId: pwaUrlId,
    pwa_name: pwaName,
    pwaName,
    name,
    installName,
    pwaInstallName: installName,
    publisher,
    logo,
    pwa_logo: logo,
    pwaLogo: logo,
    pwa_carousel: carousel,
    pwaCarousel: carousel,
    screenshots: manifestScreenshots,
    downloads: String(localizedPayload.store_downloads || payload.downloads || '').trim(),
    comments: Number.isFinite(comments) ? comments : 0,
    rating: String(
      localizedPayload.store_reviews || payload.rating || payload.store_rating || payload.store_score || '',
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
