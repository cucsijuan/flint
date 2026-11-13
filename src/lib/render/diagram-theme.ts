/** The app's colors (as `#rrggbb`) and text font, which diagrams are drawn in. */
export interface Palette {
  background: string
  backgroundSecondary: string
  text: string
  textMuted: string
  textFaint: string
  border: string
  accent: string
  fontFamily: string
  fontSize: string
}

const VARIABLES = {
  background: '--background',
  backgroundSecondary: '--background-secondary',
  text: '--text',
  textMuted: '--text-muted',
  textFaint: '--text-faint',
  border: '--border',
  accent: '--accent',
} as const

/** The light theme's colors, for when the stylesheet can't be read. */
const FALLBACK: Palette = {
  background: '#ffffff',
  backgroundSecondary: '#f6f6f7',
  text: '#222222',
  textMuted: '#6b6b75',
  textFaint: '#a0a0a8',
  border: '#e3e3e6',
  accent: '#6d5dd3',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '16px',
}

const PIE_SLICES = 8
/** 3/8 of a turn between neighboring slices: the eight hues all differ, and neighbors differ most. */
const PIE_HUE_STEP = 135
/** Critical Gantt tasks and the today line, in the red the app shows diagram errors in. */
const CRITICAL = '#d04545'

type Rgb = [number, number, number]

const channels = (hex: string) =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) as Rgb

const hexOf = (rgb: number[]) =>
  `#${rgb
    .map((value) =>
      Math.round(Math.min(255, Math.max(0, value)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

/** `#rrggbb` for a computed CSS color (`rgb()`, `rgba()` or `color(srgb …)`); '' for anything else. */
export function toHex(color: string) {
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color)
  if (rgb) return hexOf(rgb.slice(1).map(Number))
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color)
  if (srgb) return hexOf(srgb.slice(1).map((value) => Number(value) * 255))
  return ''
}

/** `amount` (0 to 1) of `color` laid over `base`. */
export function mix(color: string, base: string, amount: number) {
  const over = channels(base)
  return hexOf(channels(color).map((value, index) => value * amount + over[index] * (1 - amount)))
}

/** `color` with its hue turned by `degrees`, keeping its saturation and lightness. */
export function turnHue(color: string, degrees: number) {
  const [red, green, blue] = channels(color)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const chroma = max - min
  if (chroma === 0) return color
  const sector =
    max === red
      ? ((green - blue) / chroma + 6) % 6
      : max === green
        ? (blue - red) / chroma + 2
        : (red - green) / chroma + 4
  const hue = (((sector * 60 + degrees) % 360) + 360) % 360
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const turned: Rgb[] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ]
  return hexOf(turned[Math.floor(hue / 60)].map((value) => value + min))
}

const luminance = (hex: string) => {
  const [red, green, blue] = channels(hex)
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
}

/** The app's colors and text font as they are now, resolved from its stylesheet. */
export function readPalette(root = document.body): Palette {
  const probe = document.createElement('span')
  probe.hidden = true
  root.append(probe)
  try {
    const palette = { ...FALLBACK }
    for (const [key, variable] of Object.entries(VARIABLES)) {
      probe.style.color = `var(${variable})`
      palette[key as keyof typeof VARIABLES] =
        toHex(getComputedStyle(probe).color) || FALLBACK[key as keyof typeof VARIABLES]
    }
    probe.style.fontFamily = 'var(--font-text)'
    probe.style.fontSize = 'var(--font-size)'
    const { fontFamily, fontSize } = getComputedStyle(probe)
    if (fontFamily) palette.fontFamily = fontFamily
    if (/^\d/.test(fontSize)) palette.fontSize = fontSize
    return palette
  } finally {
    probe.remove()
  }
}

/** Mermaid's `base` theme in the app's colors: nodes tinted with the accent color, lines and text
 * like the note's, and pie slices in hues turned from the accent. */
export function themeVariables(palette: Palette) {
  const { background, backgroundSecondary, text, textMuted, textFaint, border, accent } = palette
  const darkMode = luminance(background) < 0.5
  const tint = (color: string, amount: number) => mix(color, background, amount)
  const node = tint(accent, darkMode ? 0.25 : 0.12)
  const variables: Record<string, string | boolean> = {
    darkMode,
    useGradient: false,
    dropShadow: 'none',
    fontFamily: palette.fontFamily,
    fontSize: palette.fontSize,
    background,
    textColor: text,
    titleColor: text,
    lineColor: textMuted,
    primaryColor: node,
    primaryBorderColor: accent,
    primaryTextColor: text,
    secondaryColor: backgroundSecondary,
    secondaryBorderColor: border,
    secondaryTextColor: text,
    tertiaryColor: backgroundSecondary,
    tertiaryBorderColor: border,
    tertiaryTextColor: text,
    edgeLabelBackground: background,
    clusterBkg: backgroundSecondary,
    clusterBorder: border,
    noteBkgColor: backgroundSecondary,
    noteBorderColor: border,
    noteTextColor: text,
    actorLineColor: textFaint,
    gridColor: border,
    sectionBkgColor: backgroundSecondary,
    sectionBkgColor2: backgroundSecondary,
    altSectionBkgColor: background,
    excludeBkgColor: backgroundSecondary,
    taskBkgColor: node,
    taskBorderColor: accent,
    activeTaskBkgColor: tint(accent, darkMode ? 0.45 : 0.3),
    activeTaskBorderColor: accent,
    doneTaskBkgColor: backgroundSecondary,
    doneTaskBorderColor: textFaint,
    critBkgColor: tint(CRITICAL, darkMode ? 0.55 : 0.3),
    critBorderColor: CRITICAL,
    todayLineColor: CRITICAL,
    taskTextColor: text,
    taskTextOutsideColor: text,
    taskTextLightColor: text,
    taskTextDarkColor: text,
    pieStrokeColor: background,
    pieOuterStrokeColor: border,
    pieTitleTextColor: text,
    pieSectionTextColor: text,
    pieLegendTextColor: text,
  }
  for (let slice = 0; slice < PIE_SLICES; slice++) {
    const hue = turnHue(accent, slice * PIE_HUE_STEP)
    variables[`pie${slice + 1}`] = tint(hue, darkMode ? 0.6 : 0.5)
  }
  return variables
}
