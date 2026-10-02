const FENCE = /^\s*(```|~~~)/
const SEPARATOR = /^---\s*$/

/** A note's slides: its text split at lines holding only `---`, outside code blocks. */
export function splitSlides(text: string) {
  const slides: string[][] = [[]]
  let fence: string | null = null
  for (const line of text.split('\n')) {
    const marker = line.match(FENCE)?.[1]
    if (marker && (fence === null || fence === marker)) fence = fence ? null : marker
    if (!fence && SEPARATOR.test(line)) slides.push([])
    else slides[slides.length - 1].push(line)
  }
  return slides.map((lines) => lines.join('\n').trim()).filter(Boolean)
}
