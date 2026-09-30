export interface PdfSettings {
  pageSize: string
  landscape: boolean
  /** In millimeters. */
  margin: number
  /** In percent. */
  scale: number
  includeTitle: boolean
}

/** Portrait page sizes in millimeters. */
export const PAGE_SIZES: Record<string, [number, number]> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  Tabloid: [279.4, 431.8],
}

export const DEFAULT_PDF: PdfSettings = {
  pageSize: 'A4',
  landscape: false,
  margin: 20,
  scale: 100,
  includeTitle: true,
}
