import { describe, expect, it } from 'vitest'
import { mix, type Palette, themeVariables, toHex, turnHue } from './diagram-theme'

const light: Palette = {
  background: '#ffffff',
  backgroundSecondary: '#f6f6f7',
  text: '#222222',
  textMuted: '#6b6b75',
  textFaint: '#a0a0a8',
  border: '#e3e3e6',
  accent: '#6d5dd3',
  fontFamily: '"Segoe UI", sans-serif',
  fontSize: '18px',
}
const dark: Palette = {
  ...light,
  background: '#1e1e1e',
  backgroundSecondary: '#262626',
  text: '#dcdcdc',
  accent: '#8b7cf0',
}

describe('colors', () => {
  it('reads computed CSS colors as hex', () => {
    expect(toHex('rgb(109, 93, 211)')).toBe('#6d5dd3')
    expect(toHex('rgba(255, 0, 0, 0.5)')).toBe('#ff0000')
    expect(toHex('color(srgb 1 0.5 0)')).toBe('#ff8000')
    expect(toHex('oklch(0.6 0.2 280)')).toBe('')
    expect(toHex('')).toBe('')
  })

  it('mixes a color over another', () => {
    expect(mix('#ff0000', '#ffffff', 0.25)).toBe('#ffbfbf')
    expect(mix('#6d5dd3', '#1e1e1e', 1)).toBe('#6d5dd3')
  })

  it('turns hues around the color wheel', () => {
    expect(turnHue('#ff0000', 120)).toBe('#00ff00')
    expect(turnHue('#ff0000', -120)).toBe('#0000ff')
    expect(turnHue('#808080', 90)).toBe('#808080')
  })
})

describe('diagram theme', () => {
  const isHex = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value)

  it("draws with the app's font, text and accent color", () => {
    const theme = themeVariables(light)
    expect(theme).toMatchObject({
      darkMode: false,
      fontFamily: '"Segoe UI", sans-serif',
      fontSize: '18px',
      background: '#ffffff',
      textColor: '#222222',
      primaryTextColor: '#222222',
      primaryBorderColor: '#6d5dd3',
      lineColor: '#6b6b75',
      primaryColor: mix('#6d5dd3', '#ffffff', 0.12),
    })
  })

  it('knows a dark theme by its background', () => {
    const theme = themeVariables(dark)
    expect(theme.darkMode).toBe(true)
    expect(theme.primaryColor).toBe(mix('#8b7cf0', '#1e1e1e', 0.25))
  })

  it('gives Mermaid only hex colors, which is all it understands', () => {
    for (const palette of [light, dark]) {
      const colors = Object.entries(themeVariables(palette)).filter(
        ([name]) =>
          !['darkMode', 'useGradient', 'dropShadow', 'fontFamily', 'fontSize'].includes(name),
      )
      expect(colors.filter(([, value]) => !isHex(value))).toEqual([])
    }
  })

  it('tells pie slices apart by hue', () => {
    const theme = themeVariables(light)
    const slices = Array.from({ length: 8 }, (_, index) => theme[`pie${index + 1}`])
    expect(new Set(slices).size).toBe(8)
  })
})
