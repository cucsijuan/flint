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

function linkAt(view: EditorView, position: number) {
  for (
    let node = syntaxTree(view.state).resolveInner(position, 1);
    node.parent;
    node = node.parent
  ) {
    if (node.name === 'WikiLink') return wikiLinkParts(view.state, node).destination
  }
  return null
}

function linkClicks(open: (destination: string) => void) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0) return false
      const rendered = (event.target as HTMLElement).closest<HTMLElement>('[data-link]')
      let destination = rendered?.dataset.link ?? null
      if (destination === null && (event.ctrlKey || event.metaKey)) {
        const position = view.posAtCoords(event)
        if (position !== null) destination = linkAt(view, position)
      }
      if (destination === null) return false
      event.preventDefault()
      open(destination)
      return true
    },
  })
}

export const wikiLinks = (resolve: LinkResolver, open: (destination: string) => void) => [
  resolvedLinks,
  linkResolution(resolve),
  linkClicks(open),
]
