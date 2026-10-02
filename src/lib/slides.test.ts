import { describe, expect, it } from 'vitest'
import { splitSlides } from './slides'

describe('splitSlides', () => {
  it('splits at --- lines outside code blocks and drops empty slides', () => {
    const note = '# One\n\nIntro\n---\n# Two\n```\n---\n```\n---\n\n---\n# Three'
    expect(splitSlides(note)).toEqual(['# One\n\nIntro', '# Two\n```\n---\n```', '# Three'])
  })
})
