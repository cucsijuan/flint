import { syntaxTree } from '@codemirror/language'
import { type EditorState, StateEffect, StateField } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { isExternalUrl, linkTargetOfUrl } from '../paths'
import { wikiLinkParts } from './wikilink'

export type LinkResolver = (targets: string[]) => Promise<(string | null)[]>

const RESOLVE_DELAY_MS = 150
const addResolved = StateEffect.define<Map<string, string | null>>()
const setResolved = StateEffect.define<Map<string, string | null>>()
const refreshResolved = StateEffect.define<null>()

export const resolvedLinks = StateField.define<Map<string, string | null>>({
  create: () => new Map(),
  update(resolved, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setResolved)) resolved = effect.value
      if (effect.is(addResolved)) resolved = new Map([...resolved, ...effect.value])
    }
    return resolved
  },
})

export const linkRevision = StateField.define<number>({
  create: () => 0,
  update: (revision, transaction) =>
    transaction.effects.some((effect) => effect.is(setResolved)) ? revision + 1 : revision,
})

export const refreshLinks = (view: EditorView) =>
  view.dispatch({ effects: refreshResolved.of(null) })

function linkTargets(state: EditorState) {
  const targets = new Set<string>()
  syntaxTree(state).iterate({
    enter: ({ name, from, to, node }) => {
      if (name === 'WikiLinkTarget') targets.add(state.sliceDoc(from, to))
      if (name === 'URL' && node.parent?.name === 'Image') {
        const url = state.sliceDoc(from, to)
        if (!isExternalUrl(url)) targets.add(linkTargetOfUrl(url))
      }
    },
  })
  return targets
}

function linkResolution(resolve: LinkResolver) {
  return ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | undefined
      isRefreshing = false

      constructor(readonly view: EditorView) {
        this.schedule()
      }

      update(update: ViewUpdate) {
        const isRefresh = update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(refreshResolved)),
        )
        if (
          update.docChanged ||
          isRefresh ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.isRefreshing ||= isRefresh
          this.schedule()
        }
      }

      schedule() {
        clearTimeout(this.timer)
        this.timer = setTimeout(() => void this.resolve(), RESOLVE_DELAY_MS)
      }

      async resolve() {
        const isRefresh = this.isRefreshing
        this.isRefreshing = false
        const known = this.view.state.field(resolvedLinks)
        const targets = [...linkTargets(this.view.state)].filter(
          (target) => isRefresh || !known.has(target),
        )
        if (!targets.length && !isRefresh) return
        const paths = targets.length ? await resolve(targets) : []
        const resolved = new Map(targets.map((target, i) => [target, paths[i]]))
        this.view.dispatch({ effects: (isRefresh ? setResolved : addResolved).of(resolved) })
      }

      destroy() {
        clearTimeout(this.timer)
      }
    },
  )
}

export interface Navigation {
  openLink: (destination: string, options: { newTab: boolean }) => void
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
      const isMiddle = event.button === 1
      const hasModifier = event.ctrlKey || event.metaKey
      if (event.button !== 0 && !isMiddle) return false
      let target = renderedTarget(event.target as HTMLElement)
      if (!target && (hasModifier || isMiddle)) {
        const position = view.posAtCoords(event)
        if (position !== null) target = targetAt(view, position)
      }
      if (!target) return false
      event.preventDefault()
      if ('link' in target) openLink(target.link, { newTab: hasModifier || isMiddle })
      else openTag(target.tag)
      return true
    },
  })
}

export const navigation = (resolve: LinkResolver, handlers: Navigation) => [
  resolvedLinks,
  linkRevision,
  linkResolution(resolve),
  clicks(handlers),
]
