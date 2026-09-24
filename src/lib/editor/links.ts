import { syntaxTree } from '@codemirror/language'
import { type EditorState, StateEffect, StateField } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { wikiLinkParts } from './wikilink'

export type LinkResolver = (targets: string[]) => Promise<(string | null)[]>

const RESOLVE_DELAY_MS = 150

const addResolved = StateEffect.define<Map<string, string | null>>()
const clearResolved = StateEffect.define<null>()

export const resolvedLinks = StateField.define<Map<string, string | null>>({
  create: () => new Map(),
  update(resolved, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(clearResolved)) resolved = new Map()
      if (effect.is(addResolved)) resolved = new Map([...resolved, ...effect.value])
    }
    return resolved
  },
})

export const refreshLinks = (view: EditorView) => view.dispatch({ effects: clearResolved.of(null) })

function linkTargets(state: EditorState) {
  const targets = new Set<string>()
  syntaxTree(state).iterate({
    enter: ({ name, from, to }) => {
      if (name === 'WikiLinkTarget') targets.add(state.sliceDoc(from, to))
    },
  })
  return targets
}

function linkResolution(resolve: LinkResolver) {
  return ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | undefined

      constructor(readonly view: EditorView) {
        this.schedule()
      }

      update(update: ViewUpdate) {
        const cleared = update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(clearResolved)),
        )
        if (
          update.docChanged ||
          cleared ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.schedule()
        }
      }

      schedule() {
        clearTimeout(this.timer)
        this.timer = setTimeout(() => void this.resolveMissing(), RESOLVE_DELAY_MS)
      }

      async resolveMissing() {
        const known = this.view.state.field(resolvedLinks)
        const missing = [...linkTargets(this.view.state)].filter((target) => !known.has(target))
        if (!missing.length) return
        const paths = await resolve(missing)
        this.view.dispatch({
          effects: addResolved.of(new Map(missing.map((target, i) => [target, paths[i]]))),
        })
      }

      destroy() {
        clearTimeout(this.timer)
      }
    },
  )
}

export interface Navigation {
  openLink: (destination: string) => void
  openTag: (tag: string) => void
}

type Target = { link: string } | { tag: string }

function targetAt(view: EditorView, position: number): Target | null {
  for (
    let node = syntaxTree(view.state).resolveInner(position, 1);
    node.parent;
    node = node.parent
  ) {
    if (node.name === 'WikiLink') return { link: wikiLinkParts(view.state, node).destination }
    if (node.name === 'Hashtag') return { tag: view.state.sliceDoc(node.from + 1, node.to) }
  }
  return null
}

function renderedTarget(element: HTMLElement): Target | null {
  const { link, tag } = element.closest<HTMLElement>('[data-link], [data-tag]')?.dataset ?? {}
  if (link !== undefined) return { link }
  if (tag !== undefined) return { tag }
  return null
}

function clicks({ openLink, openTag }: Navigation) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0) return false
      let target = renderedTarget(event.target as HTMLElement)
      if (!target && (event.ctrlKey || event.metaKey)) {
        const position = view.posAtCoords(event)
        if (position !== null) target = targetAt(view, position)
      }
      if (!target) return false
      event.preventDefault()
      if ('link' in target) openLink(target.link)
      else openTag(target.tag)
      return true
    },
  })
}

export const navigation = (resolve: LinkResolver, handlers: Navigation) => [
  resolvedLinks,
  linkResolution(resolve),
  clicks(handlers),
]
