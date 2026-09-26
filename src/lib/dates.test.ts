import { describe, expect, it } from 'vitest'
import {
  adjacentDailyNote,
  applyTemplate,
  dailyNoteDate,
  dailyNotePath,
  dayjs,
  DEFAULT_DAILY_NOTES,
  DEFAULT_TEMPLATES,
} from './dates'

const nested = { folder: 'Journal', format: 'YYYY/MM/YYYY-MM-DD', template: '' }

describe('daily notes', () => {
  it('builds and parses daily note paths', () => {
    const date = dayjs('2026-09-26')
    expect(dailyNotePath(date, DEFAULT_DAILY_NOTES)).toBe('2026-09-26.md')
    expect(dailyNotePath(date, nested)).toBe('Journal/2026/09/2026-09-26.md')
    expect(dailyNoteDate('Journal/2026/09/2026-09-26.md', nested)?.format('YYYY-MM-DD')).toBe(
      '2026-09-26',
    )
    expect(dailyNoteDate('Other/2026-09-26.md', nested)).toBeNull()
    expect(dailyNoteDate('Ideas.md', DEFAULT_DAILY_NOTES)).toBeNull()
  })

  it('finds the closest existing daily note in each direction', () => {
    const paths = ['2026-09-20.md', '2026-09-24.md', '2026-09-26.md', '2026-10-01.md', 'Ideas.md']
    const from = dayjs('2026-09-26')
    expect(adjacentDailyNote(paths, from, -1, DEFAULT_DAILY_NOTES)).toBe('2026-09-24.md')
    expect(adjacentDailyNote(paths, from, 1, DEFAULT_DAILY_NOTES)).toBe('2026-10-01.md')
    expect(adjacentDailyNote(paths, dayjs('2026-10-01'), 1, DEFAULT_DAILY_NOTES)).toBeNull()
  })
})

describe('templates', () => {
  it('fills in title, date and time, with optional formats', () => {
    const date = dayjs('2026-09-26T14:05:00')
    const text = '# {{title}}\n{{date}} {{time}} {{date:dddd, D MMMM}} {{ time:HH }} {{other}}'
    expect(applyTemplate(text, { title: 'Plan', date }, DEFAULT_TEMPLATES)).toBe(
      '# Plan\n2026-09-26 14:05 Saturday, 26 September 14 {{other}}',
    )
  })
})
