import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { noteTitle, parentOf } from '../paths'
import type { NoteBlock } from '../render/source'
import type { Heading, LinkTarget, TagCount } from '../vault'
import { completeSlash, type SlashSources } from './slash'

export interface CompletionSources {
  targets: () => LinkTarget[]
  headings: (target: string) => Promise<Heading[]>
  blocks: (target: string) => Promise<{ path: string; blocks: NoteBlock[] } | null>
  /** Blocks anywhere in the vault matching `query`. */
  searchBlocks: (query: string) => Promise<{ path: string; block: NoteBlock }[]>
  /** Gives a block an id in its note and returns it. */
  addBlockId: (path: string, block: NoteBlock) => string
  tags: () => TagCount[]
  slash: SlashSources
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

const blockLabel = ({ text }: NoteBlock) =>
  text.length > BLOCK_LABEL_LENGTH ? `${text.slice(0, BLOCK_LABEL_LENGTH)}…` : text

/** Links to a block, first giving it an id when it has none. */
function insertBlockLink(
  sources: CompletionSources,
  path: string,
  block: NoteBlock,
  link: (id: string) => string,
) {
  return (view: EditorView, completion: Completion, from: number, to: number) => {
    const id = block.id ?? sources.addBlockId(path, block)
    insertLink(link(id))(view, completion, from, to)
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

  if (query.startsWith('^^')) {
    const blocks = await sources.searchBlocks(query.slice(2))
    const linkTexts = new Map(
      sources
        .targets()
        .filter(({ alias }) => !alias)
        .map(({ path, linkText }) => [path, linkText]),
    )
    return {
      from,
      filter: false,
      options: blocks.map(({ path, block }) => ({
        label: blockLabel(block),
        detail: noteTitle(path),
        apply: insertBlockLink(
          sources,
          path,
          block,
          (id) => `${linkTexts.get(path) ?? noteTitle(path)}#^${id}`,
        ),
      })),
    }
  }

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
    const note = await sources.blocks(target)
    if (!note) return null
    return {
      from: from + hash + 2,
      options: note.blocks.map((block) => ({
        label: blockLabel(block),
        detail: block.id ? `^${block.id}` : undefined,
        apply: insertBlockLink(sources, note.path, block, (id) => id),
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
      (context) => completeSlash(context, sources.slash),
    ],
    icons: false,
  })
