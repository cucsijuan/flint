export const NOTE_EXTENSION = '.md'

export const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

export const parentOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf('/'), 0))

export const join = (folder: string, name: string) => (folder ? `${folder}/${name}` : name)

export const noteTitle = (path: string) => {
  const name = basename(path)
  return name.toLowerCase().endsWith(NOTE_EXTENSION) ? name.slice(0, -NOTE_EXTENSION.length) : name
}

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'])

export const extensionOf = (path: string) => {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export const isImage = (path: string) => IMAGE_EXTENSIONS.has(extensionOf(path))

const EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i

export const isExternalUrl = (url: string) => EXTERNAL_URL.test(url)

export function linkTargetOfUrl(url: string) {
  try {
    return decodeURI(url).replace(/^\.\//, '')
  } catch {
    return url
  }
}

export const isWithin = (path: string, folder: string) =>
  path === folder || path.startsWith(`${folder}/`)

export const replacePrefix = (path: string, from: string, to: string) =>
  isWithin(path, from) ? to + path.slice(from.length) : path

export const uniqueName = (taken: Set<string>, folder: string, base: string, extension = '') => {
  for (let index = 0; ; index++) {
    const name = index === 0 ? `${base}${extension}` : `${base} ${index}${extension}`
    if (!taken.has(join(folder, name))) return join(folder, name)
  }
}
