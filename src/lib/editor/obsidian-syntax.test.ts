import { markdownLanguage } from '@codemirror/lang-markdown'
import type { MarkdownParser } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { obsidianSyntax } from './obsidian-syntax'

const parser = (markdownLanguage.parser as MarkdownParser).configure(obsidianSyntax)

function nodes(text: string) {
  const found: string[] = []
  parser.parse(text).iterate({
    enter: ({ name, from, to }) => {
      if (
        /^(InlineMath|BlockMath|Highlight|Comment|CommentBlock|FootnoteReference|BlockId)$/.test(
          name,
        )
      ) {
        found.push(`${name} ${text.slice(from, to)}`)
      }
    },
  })
  return found
}

describe('obsidianSyntax', () => {
  it('parses inline and block math, but not prices', () => {
    expect(nodes('Area $\\pi r^2$ and $$E=mc^2$$ cost $5 and $10.')).toEqual([
      'InlineMath $\\pi r^2$',
      'InlineMath $$E=mc^2$$',
    ])
    expect(nodes('$$\n\\sum_i x_i\n$$\n\nafter')).toEqual(['BlockMath $$\n\\sum_i x_i\n$$'])
  })

  it('parses highlights, comments and footnote references', () => {
    expect(nodes('A ==key idea== here %%hidden%% and a note[^1].')).toEqual([
      'Highlight ==key idea==',
      'Comment %%hidden%%',
      'FootnoteReference [^1]',
    ])
    expect(nodes('%%\nmany\nlines\n%%\n\ntext')).toEqual(['CommentBlock %%\nmany\nlines\n%%'])
  })

  it('parses block ids only at the end of a line', () => {
    expect(nodes('Para ^id-1\nx^no and ^no more\n\n^alone')).toEqual([
      'BlockId ^id-1',
      'BlockId ^alone',
    ])
  })
})
