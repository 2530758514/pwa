// Private Safari scheme: the host may reject it, especially without a user click.
// Constructing or dispatching the URL does not confirm a successful iOS handoff.
export function buildSafariOpenUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return ''
    return url.href.replace(/^https:/, 'x-safari-https:')
  } catch {
    return ''
  }
}
