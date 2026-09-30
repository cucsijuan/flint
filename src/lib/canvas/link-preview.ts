import * as vault from '../vault'

export interface LinkPreview {
  title: string
  description: string
  image: string | null
  site: string
}

const TIMEOUT_MS = 10_000

const cache = new Map<string, Promise<LinkPreview>>()

/** A page's title, description and image, from its Open Graph and Twitter tags. */
export function parseLinkPreview(html: string, url: string): LinkPreview {
  const page = new DOMParser().parseFromString(html, 'text/html')
  const meta = (...names: string[]) => {
    for (const name of names) {
      const content = page
        .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
        ?.getAttribute('content')
        ?.trim()
      if (content) return content
    }
    return ''
  }
  const site = new URL(url).hostname.replace(/^www\./, '')
  const image = meta('og:image', 'og:image:url', 'twitter:image')
  return {
    title: meta('og:title', 'twitter:title') || page.title.trim() || site,
    description: meta('og:description', 'twitter:description', 'description'),
    image: image ? new URL(image, url).href : null,
    site: meta('og:site_name') || site,
  }
}

export function linkPreview(url: string) {
  let preview = cache.get(url)
  if (!preview) {
    preview = vault
      .pluginHttpRequest({ url, timeoutMs: TIMEOUT_MS })
      .then((response) => parseLinkPreview(response.body, url))
    preview.catch(() => cache.delete(url))
    cache.set(url, preview)
  }
  return preview
}
