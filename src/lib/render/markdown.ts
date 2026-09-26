import DOMPurify from 'dompurify'
import markdownIt, { type MarkdownIt, type StateCore, type StateInline } from 'markdown-it'

type PluginSimple = (md: MarkdownIt) => void

const TAG_CHAR = /[\p{L}\p{N}_/-]/u
const TASK = /^\[([ xX])\]\s/
const CALLOUT = /^\[!([\w-]+)\]([+-])?[ \t]*(.*)$/

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
      checkbox.content = `<input type="checkbox" class="task"${checked}> `
      token.children?.unshift(checkbox)
      listItem.attrJoin('class', 'task-list-item')
    })
  })
}

/** Obsidian callouts: `> [!type]` with an optional title, foldable with `+` (open) or `-` (closed). */
const callouts: PluginSimple = (md) => {
  md.core.ruler.after('block', 'callouts', (state: StateCore) => {
    const { tokens } = state
    for (let index = 0; index < tokens.length; index++) {
      const open = tokens[index]
      const inline = tokens[index + 2]
      if (open.type !== 'blockquote_open' || inline?.type !== 'inline') continue
      const [firstLine, ...rest] = inline.content.split('\n')
      const match = CALLOUT.exec(firstLine)
      if (!match) continue
      const [, type, fold, title] = match
      const tag = fold ? 'details' : 'div'
      const close = tokens.findIndex(
        (token, at) =>
          at > index && token.type === 'blockquote_close' && token.level === open.level,
      )
      open.tag = tokens[close].tag = tag
      open.attrJoin('class', 'callout')
      open.attrSet('data-callout', type.toLowerCase())
      if (fold === '+') open.attrSet('open', '')

      const titleOpen = new state.Token('callout_title_open', fold ? 'summary' : 'div', 1)
      titleOpen.attrSet('class', 'callout-title')
      const titleText = new state.Token('inline', '', 0)
      titleText.content = title || type[0].toUpperCase() + type.slice(1).toLowerCase()
      titleText.children = []
      const titleClose = new state.Token('callout_title_close', titleOpen.tag, -1)
      const contentOpen = new state.Token('callout_content_open', 'div', 1)
      contentOpen.attrSet('class', 'callout-content')
      const contentClose = new state.Token('callout_content_close', 'div', -1)
      for (const token of [titleOpen, titleClose, contentOpen, contentClose]) token.block = true

      inline.content = rest.join('\n')
      const emptyParagraph = inline.content.trim() ? 0 : 3
      tokens.splice(close, 0, contentClose)
      tokens.splice(index + 1, emptyParagraph, titleOpen, titleText, titleClose, contentOpen)
    }
  })
}

/** Marks every block with the source lines it came from, so rendered content can edit its note. */
const sourceLines: PluginSimple = (md) => {
  md.core.ruler.push('source-lines', (state: StateCore) => {
    const firstLine = (state.env as RenderOptions).firstLine ?? 0
    for (const token of state.tokens) {
      if (!token.block || !token.map || token.nesting === -1) continue
      token.attrSet('data-line', String(token.map[0] + firstLine))
      token.attrSet('data-line-end', String(token.map[1] + firstLine))
    }
  })
}

const markdown = markdownIt({ html: true, linkify: true })
  .use(wikiLinks)
  .use(hashtags)
  .use(taskLists)
  .use(callouts)
  .use(sourceLines)

export interface RenderOptions {
  /** Line of the note where `text` starts, when it is only part of the note. */
  firstLine?: number
}

export function renderMarkdown(text: string, options: RenderOptions = {}) {
  return DOMPurify.sanitize(markdown.render(text, { ...options }), { ADD_ATTR: ['target'] })
}
