export function facebookShareImagePlugin(env) {
  const raw = String(env.VITE_FACEBOOK_SHARE_IMAGE_URL || '').trim()
  if (!raw) return {
    name: 'facebook-share-image',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { property: 'og:title', content: '' }, injectTo: 'head' }],
  }
  const image = new URL(raw)
  if (image.protocol !== 'https:' || image.username || image.password) {
    throw new Error('VITE_FACEBOOK_SHARE_IMAGE_URL must be a public HTTPS image URL')
  }
  return {
    name: 'facebook-share-image',
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { property: 'og:title', content: '' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image', content: image.href }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:secure_url', content: image.href }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:type', content: 'image/png' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '800' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '480' }, injectTo: 'head' },
      ]
    },
  }
}
