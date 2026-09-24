const COMPATIBLE = new Set(
  [
    'AGPL-3.0',
    'AGPL-3.0-only',
    'AGPL-3.0-or-later',
    'GPL-3.0',
    'GPL-3.0-only',
    'GPL-3.0-or-later',
    'GPL-2.0-or-later',
    'LGPL-3.0',
    'LGPL-3.0-only',
    'LGPL-3.0-or-later',
    'LGPL-2.1-only',
    'LGPL-2.1-or-later',
    'MPL-2.0',
    'Apache-2.0',
    'MIT',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
    '0BSD',
    'Zlib',
    'Unlicense',
  ].map((id) => id.toLowerCase()),
)

export function isCompatibleLicense(expression: string) {
  const alternatives = expression.replace(/[()]/g, '').split(/\s+OR\s+/i)
  return alternatives.some((alternative) =>
    alternative
      .split(/\s+AND\s+/i)
      .every((id) => id.trim() !== '' && COMPATIBLE.has(id.trim().toLowerCase())),
  )
}
