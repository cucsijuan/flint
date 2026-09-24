import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { noteTitle, parentOf } from '../paths'
import type { Heading, LinkTarget } from '../vault'

export interface LinkCompletionSources {
  targets: () => LinkTarget[]
  headings: (target: string) => Promise<Heading[]>
}

const OPEN_LINK = /\[\[([^[\]|\n]*)$/

function insertLink(text: string) {
  return (view: EditorView, _completion: Completion, from: number, to: number) => {
    const isClosed = view.state.sliceDoc(to, to + 2) === ']]'
    const insert = isClosed ? text : `${text}]]`
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length + (isClosed ? 2 : 0) },
    })
  }
}

async function completeLink(
  context: CompletionContext,
  sources: LinkCompletionSources,
): Promise<CompletionResult | null> {
  const match = context.matchBefore(OPEN_LINK)
  if (!match) return null
  const query = match.text.slice(2)
  const from = match.from + 2
  const hash = query.indexOf('#')

  if (hash === -1) {
    return {
      from,
      options: sources.targets().map(({ path, linkText }) => ({
        label: noteTitle(path),
        detail: parentOf(path),
        apply: insertLink(linkText),
      })),
    }
  }

  const target = query.slice(0, hash)
  const headings = await sources.headings(target)
  return {
    from: from + hash + 1,
    options: headings.map(({ text, level }) => ({
      label: text,
      detail: 'H' + level,
      apply: insertLink(text),
    })),
  }
}

export const linkCompletion = (sources: LinkCompletionSources) =>
  autocompletion({
    override: [(context) => completeLink(context, sources)],
    icons: false,
  })
