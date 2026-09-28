// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMath } from './math'

describe('renderMath', () => {
  it('renders TeX, including packages like physics and mhchem, as SVG', async () => {
    const inline = await renderMath('\\dv{f}{x} + \\ce{H2O}', false)
    expect(inline.tagName.toLowerCase()).toBe('mjx-container')
    expect(inline.querySelector('svg')).not.toBeNull()
    const block = await renderMath('\\sum_{i=1}^n i', true)
    expect(block.getAttribute('display')).toBe('true')
  })

  it('shows TeX errors instead of failing', async () => {
    const error = await renderMath('\\frac{1}', false)
    expect(error.textContent).not.toBe('')
  })
})
