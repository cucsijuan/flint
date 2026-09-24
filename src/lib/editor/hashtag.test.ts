import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { hashtagSyntax } from './hashtag'

function hashtags(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: markdown({ base: markdownLanguage, extensions: hashtagSyntax }),
  })
  const tree = ensureSyntaxTree(state, doc.length, 5000)
  if (!tree) throw new Error('Parsing timed out')
  const found: string[] = []
  tree.iterate({
    enter: ({ name, from, to }) => {
      if (name === 'Hashtag') found.push(state.sliceDoc(from, to))
    },
  })
  return found
}

describe('hashtag syntax', () => {
  it('finds tags at word starts, including nested ones', () => {
    expect(hashtags('#start text #nested/tag, #año')).toEqual(['#start', '#nested/tag', '#año'])
  })

  it('ignores headings, numbers, anchors and code', () => {
    expect(hashtags('# Heading\n\n#123 url/#anchor a#b `#code`')).toEqual([])
  })
})
