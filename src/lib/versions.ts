/** Orders `major.minor.patch` versions; missing parts count as zero. */
export function compareVersions(a: string, b: string) {
  const parts = (version: string) =>
    version.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const [left, right] = [parts(a), parts(b)]
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference) return Math.sign(difference)
  }
  return 0
}
