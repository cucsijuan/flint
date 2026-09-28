import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { noteTitle, parentOf } from '../paths'
import type { BlockId } from '../render/source'
import type { Heading, LinkTarget, TagCount } from '../vault'

export interface CompletionSources {
  targets: () => LinkTarget[]
  headings: (target: string) => Promise<Heading[]>
  blocks: (target: string) => Promise<BlockId[]>
  tags: () => TagCount[]
}

const OPEN_LINK = /\[\[([^[\]|\n]*)$/
const BLOCK_LABEL_LENGTH = 60
const OPEN_TAG = /(?:^|\s)#[\p{L}\p{N}_/-]*$/u

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

function completeTag(
  context: CompletionContext,
  sources: CompletionSources,
): CompletionResult | null {
  const match = context.matchBefore(OPEN_TAG)
  if (!match) return null
  return {
    from: match.from + match.text.indexOf('#') + 1,
    options: sources.tags().map(({ tag, count }) => ({ label: tag, detail: String(count) })),
    validFor: /^[\p{L}\p{N}_/-]*$/u,
  }
}

async function completeLink(
  context: CompletionContext,
  sources: CompletionSources,
): Promise<CompletionResult | null> {
  const match = context.matchBefore(OPEN_LINK)
  if (!match) return null
  const query = match.text.slice(2)
  const from = match.from + 2
  const hash = query.indexOf('#')

  if (hash === -1) {
    return {
      from,
      options: sources.targets().map(({ path, linkText, alias }) =>
        alias
          ? {
              label: alias,
              detail: `→ ${noteTitle(path)}`,
              apply: insertLink(`${linkText}|${alias}`),
            }
          : { label: noteTitle(path), detail: parentOf(path), apply: insertLink(linkText) },
      ),
    }
  }

  const target = query.slice(0, hash)
  if (query[hash + 1] === '^') {
    const blocks = await sources.blocks(target)
    return {
      from: from + hash + 2,
      options: blocks.map(({ id, text }) => ({
        label: text.length > BLOCK_LABEL_LENGTH ? `${text.slice(0, BLOCK_LABEL_LENGTH)}…` : text,
        detail: `^${id}`,
        apply: insertLink(id),
      })),
    }
  }
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

export const completion = (sources: CompletionSources) =>
  autocompletion({
    override: [
      (context) => completeLink(context, sources),
      (context) => completeTag(context, sources),
    ],
    icons: false,
  })
