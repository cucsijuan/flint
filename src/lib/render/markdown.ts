import DOMPurify from 'dompurify'
import markdownIt, { type MarkdownIt, type StateCore, type StateInline } from 'markdown-it'

type PluginSimple = (md: MarkdownIt) => void

const TAG_CHAR = /[\p{L}\p{N}_/-]/u
const TASK = /^\[([ xX])\]\s/

const wikiLinks: PluginSimple = (md) => {
  md.inline.ruler.before('link', 'wikilink', (state: StateInline, silent: boolean) => {
    const start = state.pos
    const isEmbed = state.src.startsWith('![[', start)
    if (!isEmbed && !state.src.startsWith('[[', start)) return false
    const innerStart = start + (isEmbed ? 3 : 2)
    const close = state.src.indexOf(']]', innerStart)
    const inner = state.src.slice(innerStart, close)
    if (close === -1 || !inner || /[\n[]/.test(inner)) return false
    if (!silent) {
      const [destination, alias] = inner.split('|', 2)
      const token = state.push(isEmbed ? 'wikiembed' : 'wikilink', isEmbed ? 'span' : 'a', 0)
      token.content = destination
      token.info = alias ?? (isEmbed ? '' : destination.replace('#', ' › '))
    }
    state.pos = close + 2
    return true
  })
  const escape = md.utils.escapeHtml
  md.renderer.rules.wikilink = (tokens, index) => {
    const { content, info } = tokens[index]
    return `<a class="internal-link" href="#" data-link="${escape(content)}">${escape(info)}</a>`
  }
  md.renderer.rules.wikiembed = (tokens, index) => {
    const { content, info } = tokens[index]
    const title = info ? ` title="${escape(info)}"` : ''
    return `<span class="internal-embed" data-embed="${escape(content)}"${title}></span>`
  }
}

const hashtags: PluginSimple = (md) => {
  md.inline.ruler.push('hashtag', (state: StateInline, silent: boolean) => {
    const start = state.pos
    if (state.src[start] !== '#') return false
    if (start > 0 && !/\s/.test(state.src[start - 1])) return false
    let end = start + 1
    while (end < state.posMax && TAG_CHAR.test(state.src[end])) end++
    const tag = state.src.slice(start + 1, end)
    if (!tag || /^\d+$/.test(tag)) return false
    if (!silent) state.push('hashtag', 'a', 0).content = tag
    state.pos = end
    return true
  })
  md.renderer.rules.hashtag = (tokens, index) => {
    const tag = md.utils.escapeHtml(tokens[index].content)
    return `<a class="tag" href="#" data-tag="${tag}">#${tag}</a>`
  }
}

const taskLists: PluginSimple = (md) => {
  md.core.ruler.after('inline', 'task-lists', (state: StateCore) => {
    state.tokens.forEach((token, index) => {
      const listItem = state.tokens[index - 2]
      const first = token.children?.[0]
      if (token.type !== 'inline' || listItem?.type !== 'list_item_open' || !first) return
      const match = first.type === 'text' ? TASK.exec(first.content) : null
      if (!match) return
      first.content = first.content.slice(match[0].length)
      const checkbox = new state.Token('html_inline', '', 0)
      const checked = match[1] === ' ' ? '' : ' checked'
      checkbox.content = `<input type="checkbox" class="task" disabled${checked}> `
      token.children?.unshift(checkbox)
      listItem.attrJoin('class', 'task-list-item')
    })
  })
}

const markdown = markdownIt({ html: true, linkify: true })
  .use(wikiLinks)
  .use(hashtags)
  .use(taskLists)

export function renderMarkdown(text: string) {
  return DOMPurify.sanitize(markdown.render(text), { ADD_ATTR: ['target'] })
}
