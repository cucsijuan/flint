import dayjs, { type Dayjs } from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { isWithin, NOTE_EXTENSION } from './paths'

dayjs.extend(advancedFormat)
dayjs.extend(customParseFormat)
dayjs.extend(localizedFormat)
dayjs.extend(weekOfYear)

export { dayjs, type Dayjs }

export interface DailyNoteSettings {
  folder: string
  /** Moment-style tokens, as in Obsidian; may contain `/` to nest notes in folders. */
  format: string
  /** Path of the template note, without the extension. */
  template: string
}

export interface TemplateSettings {
  folder: string
  dateFormat: string
  timeFormat: string
}

export const DEFAULT_DAILY_NOTES: DailyNoteSettings = {
  folder: '',
  format: 'YYYY-MM-DD',
  template: '',
}

export const DEFAULT_TEMPLATES: TemplateSettings = {
  folder: 'Templates',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:mm',
}

const TEMPLATE_VARIABLE = /\{\{\s*(title|date|time)(?::([^}]*))?\s*\}\}/gi

const withinFolder = (folder: string, name: string) => (folder ? `${folder}/${name}` : name)

export const dailyNotePath = (date: Dayjs, { folder, format }: DailyNoteSettings) =>
  withinFolder(folder, date.format(format || DEFAULT_DAILY_NOTES.format)) + NOTE_EXTENSION

export function dailyNoteDate(path: string, { folder, format }: DailyNoteSettings) {
  if (!path.endsWith(NOTE_EXTENSION) || (folder && !isWithin(path, folder))) return null
  const name = path.slice(folder ? folder.length + 1 : 0, -NOTE_EXTENSION.length)
  const date = dayjs(name, format || DEFAULT_DAILY_NOTES.format, true)
  return date.isValid() ? date : null
}

/** The closest existing daily note before (`-1`) or after (`1`) `from`. */
export function adjacentDailyNote(
  paths: string[],
  from: Dayjs,
  direction: 1 | -1,
  settings: DailyNoteSettings,
) {
  let best: { path: string; date: Dayjs } | null = null
  for (const path of paths) {
    const date = dailyNoteDate(path, settings)
    if (!date || date.isSame(from, 'day') || date.isAfter(from) !== (direction === 1)) continue
    const isCloser = !best || (direction === 1 ? date.isBefore(best.date) : date.isAfter(best.date))
    if (isCloser) best = { path, date }
  }
  return best?.path ?? null
}

export function applyTemplate(
  text: string,
  { title, date }: { title: string; date: Dayjs },
  { dateFormat, timeFormat }: TemplateSettings,
) {
  return text.replace(TEMPLATE_VARIABLE, (_, name: string, format?: string) => {
    const variable = name.toLowerCase()
    if (variable === 'title') return title
    return date.format(format?.trim() || (variable === 'date' ? dateFormat : timeFormat))
  })
}
