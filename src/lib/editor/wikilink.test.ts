import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { wikiLinkParts, wikiLinkSyntax } from './wikilink'

function parse(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: markdown({ base: markdownLanguage, extensions: wikiLinkSyntax }),
  })
  const tree = ensureSyntaxTree(state, doc.length, 5000)
  if (!tree) throw new Error('Parsing timed out')
  const links: { text: string; destination: string; alias: string }[] = []
  tree.iterate({
    enter: ({ name, node }) => {
      if (name !== 'WikiLink') return
      const { destination, aliasNode } = wikiLinkParts(state, node)
      links.push({
        text: state.sliceDoc(node.from, node.to),
        destination,
        alias: aliasNode ? state.sliceDoc(aliasNode.from, aliasNode.to) : '',
      })
    },
  })
  return links
}

describe('wikilink syntax', () => {
  it('parses targets, subpaths, aliases and embeds', () => {
    expect(parse('a [[Note]] b ![[Folder/Pic#Part|Alt]] [[#Local]]')).toEqual([
      { text: '[[Note]]', destination: 'Note', alias: '' },
      { text: '![[Folder/Pic#Part|Alt]]', destination: 'Folder/Pic#Part', alias: 'Alt' },
      { text: '[[#Local]]', destination: '#Local', alias: '' },
    ])
  })

  it('ignores empty, unclosed and code wikilinks', () => {
    expect(parse('[[]] [[open\n`[[code]]`')).toEqual([])
  })
})
