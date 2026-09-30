import dayjs, { type Dayjs, type ManipulateType } from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(advancedFormat)
dayjs.extend(customParseFormat)
dayjs.extend(relativeTime)

/** What Flint knows about a note, as Bases' `file` object exposes it. */
export interface FileInfo {
  path: string
  name: string
  basename: string
  folder: string
  ext: string
  size: number
  /** Milliseconds since the epoch. */
  ctime: number
  mtime: number
  tags: string[]
  /** Paths this note links to. */
  links: string[]
  backlinks: string[]
  embeds: string[]
  properties: Record<string, unknown>
}

export class DateValue {
  constructor(
    readonly value: Dayjs,
    readonly hasTime: boolean,
  ) {}
}

export class Duration {
  constructor(readonly parts: { amount: number; unit: ManipulateType }[]) {}

  get ms() {
    const start = dayjs(0)
    return this.parts.reduce((date, part) => date.add(part.amount, part.unit), start).valueOf()
  }
}

export class Link {
  constructor(
    readonly target: string,
    readonly display: string | null = null,
  ) {}
}

export class FileValue {
  constructor(readonly file: FileInfo) {}
}

/** Values only meant for display: `html()`, `image()` and `icon()`. */
export class Rendered {
  constructor(
    readonly kind: 'html' | 'image' | 'icon',
    readonly source: string,
  ) {}
}

export type Value =
  | null
  | boolean
  | number
  | string
  | DateValue
  | Duration
  | Link
  | FileValue
  | RegExp
  | Rendered
  | Value[]
  | { [key: string]: Value }

// ---------------------------------------------------------------------------------------------
// Syntax

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'regex'; value: RegExp }
  | { type: 'name'; value: string }
  | { type: 'op'; value: string }

export type Expr =
  | { kind: 'literal'; value: Value }
  | { kind: 'name'; name: string }
  | { kind: 'member'; object: Expr; name: string }
  | { kind: 'index'; object: Expr; index: Expr }
  | { kind: 'call'; callee: Expr; args: Expr[] }
  | { kind: 'unary'; op: string; operand: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'list'; items: Expr[] }

export class ExpressionError extends Error {}

const OPERATORS = ['==', '!=', '>=', '<=', '&&', '||', '+', '-', '*', '/', '%', '>', '<', '!']
const PUNCTUATION = '()[],.'

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  const endsValue = () => {
    const last = tokens.at(-1)
    return last !== undefined && (last.type !== 'op' || last.value === ')' || last.value === ']')
  }
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) {
      index++
    } else if (/\d/.test(char)) {
      const match = /^\d+(?:\.\d+)?/.exec(source.slice(index))?.[0] ?? char
      tokens.push({ type: 'number', value: Number(match) })
      index += match.length
    } else if (char === '"' || char === "'") {
      let value = ''
      index++
      while (index < source.length && source[index] !== char) {
        if (source[index] === '\\') index++
        value += source[index++] ?? ''
      }
      if (index >= source.length) throw new ExpressionError('Missing closing quote')
      index++
      tokens.push({ type: 'string', value })
    } else if (char === '/' && !endsValue()) {
      const match = /^\/((?:\\.|[^/\\])+)\/([a-z]*)/.exec(source.slice(index))
      if (!match) throw new ExpressionError('Unclosed regular expression')
      tokens.push({ type: 'regex', value: new RegExp(match[1], match[2]) })
      index += match[0].length
    } else if (/[\p{L}_$]/u.test(char)) {
      const match = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(source.slice(index))?.[0]
      const name = match ?? char
      tokens.push({ type: 'name', value: name })
      index += name.length
    } else {
      const op = OPERATORS.find((candidate) => source.startsWith(candidate, index))
      if (op) {
        tokens.push({ type: 'op', value: op })
        index += op.length
      } else if (PUNCTUATION.includes(char)) {
        tokens.push({ type: 'op', value: char })
        index++
      } else {
        throw new ExpressionError(`Unexpected "${char}"`)
      }
    }
  }
  return tokens
}

const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
}

class Parser {
  private position = 0

  constructor(private readonly tokens: Token[]) {}

  parse(): Expr {
    const expr = this.binary(0)
    if (this.position < this.tokens.length) throw new ExpressionError('Unexpected text at the end')
    return expr
  }

  private peek() {
    return this.tokens[this.position]
  }

  private isOp(value: string) {
    const token = this.peek()
    return token?.type === 'op' && token.value === value
  }

  private expect(value: string) {
    if (!this.isOp(value)) throw new ExpressionError(`Expected "${value}"`)
    this.position++
  }

  private binary(minimum: number): Expr {
    let left = this.unary()
    for (;;) {
      const token = this.peek()
      const precedence = token?.type === 'op' ? PRECEDENCE[token.value] : undefined
      if (precedence === undefined || precedence <= minimum) return left
      this.position++
      left = { kind: 'binary', op: token.value as string, left, right: this.binary(precedence) }
    }
  }

  private unary(): Expr {
    if (this.isOp('!') || this.isOp('-')) {
      const op = (this.tokens[this.position++] as { value: string }).value
      return { kind: 'unary', op, operand: this.unary() }
    }
    return this.postfix(this.primary())
  }

  private arguments(close: string) {
    const args: Expr[] = []
    while (!this.isOp(close)) {
      args.push(this.binary(0))
      if (!this.isOp(close)) this.expect(',')
    }
    this.position++
    return args
  }

  private postfix(expr: Expr): Expr {
    for (;;) {
      if (this.isOp('.')) {
        this.position++
        const name = this.peek()
        if (name?.type !== 'name') throw new ExpressionError('Expected a name after "."')
        this.position++
        expr = { kind: 'member', object: expr, name: name.value }
      } else if (this.isOp('[')) {
        this.position++
        const index = this.binary(0)
        this.expect(']')
        expr = { kind: 'index', object: expr, index }
      } else if (this.isOp('(')) {
        this.position++
        expr = { kind: 'call', callee: expr, args: this.arguments(')') }
      } else {
        return expr
      }
    }
  }

  private primary(): Expr {
    const token = this.tokens[this.position++]
    if (!token) throw new ExpressionError('Unexpected end of expression')
    switch (token.type) {
      case 'number':
      case 'string':
      case 'regex':
        return { kind: 'literal', value: token.value }
      case 'name':
        if (token.value === 'true' || token.value === 'false') {
          return { kind: 'literal', value: token.value === 'true' }
        }
        if (token.value === 'null') return { kind: 'literal', value: null }
        return { kind: 'name', name: token.value }
      case 'op':
        if (token.value === '(') {
          const expr = this.binary(0)
          this.expect(')')
          return expr
        }
        if (token.value === '[') return { kind: 'list', items: this.arguments(']') }
    }
    throw new ExpressionError(`Unexpected "${String(token.value)}"`)
  }
}

const parsed = new Map<string, Expr>()

export function parseExpression(source: string): Expr {
  let expr = parsed.get(source)
  if (!expr) {
    expr = new Parser(tokenize(source)).parse()
    parsed.set(source, expr)
  }
  return expr
}

// ---------------------------------------------------------------------------------------------
// Values

const UNITS: Record<string, ManipulateType> = {
  y: 'year',
  year: 'year',
  years: 'year',
  M: 'month',
  month: 'month',
  months: 'month',
  w: 'week',
  week: 'week',
  weeks: 'week',
  d: 'day',
  day: 'day',
  days: 'day',
  h: 'hour',
  hour: 'hour',
  hours: 'hour',
  m: 'minute',
  minute: 'minute',
  minutes: 'minute',
  s: 'second',
  second: 'second',
  seconds: 'second',
}

export function parseDuration(text: string): Duration | null {
  const parts = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g)].map(([, amount, unit]) => ({
    amount: Number(amount),
    unit: UNITS[unit] ?? UNITS[unit.toLowerCase()],
  }))
  return parts.length && parts.every((part) => part.unit) ? new Duration(parts) : null
}

const DATE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DDTHH:mm',
  'YYYY-MM-DDTHH:mm:ss',
]

export function parseDate(text: string): DateValue | null {
  const trimmed = text.trim()
  const parsedDate = dayjs(trimmed, DATE_FORMATS, true)
  const date = parsedDate.isValid() ? parsedDate : dayjs(trimmed)
  if (!date.isValid() || !/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null
  return new DateValue(date, /\d{2}:\d{2}/.test(trimmed))
}

export const isList = (value: unknown): value is Value[] => Array.isArray(value)

export const isObject = (value: Value): value is { [key: string]: Value } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

export function isTruthy(value: Value): boolean {
  if (value === null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value)
  if (typeof value === 'string') return value.length > 0
  if (isList(value)) return value.length > 0
  return true
}

function isEmpty(value: Value) {
  if (value === null || value === '') return true
  if (isList(value)) return value.length === 0
  if (isObject(value)) return Object.keys(value).length === 0
  return false
}

/** How a value reads in a table cell or as text. */
export function display(value: Value): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number')
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof DateValue) {
    return value.value.format(value.hasTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD')
  }
  if (value instanceof Duration) {
    return value.parts
      .map(({ amount, unit }) => `${amount} ${unit}${Math.abs(amount) === 1 ? '' : 's'}`)
      .join(' ')
  }
  if (value instanceof Link) return value.display ?? value.target
  if (value instanceof FileValue) return value.file.basename
  if (value instanceof RegExp) return String(value)
  if (value instanceof Rendered) return value.source
  if (isList(value)) return value.map(display).join(', ')
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).map(([key, item]) => [key, display(item)])),
  )
}

function comparable(value: Value): number | string | null {
  if (value === null) return null
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof DateValue) return value.value.valueOf()
  if (value instanceof Duration) return value.ms
  return display(value).toLowerCase()
}

/** Orders values the way Bases sorts a column: empty values last, numbers and dates by value. */
export function compare(a: Value, b: Value): number {
  const left = comparable(a)
  const right = comparable(b)
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), undefined, { numeric: true })
}

/** Finds a note by path or link target, so links and files compare by the note they mean. */
type FindFile = (target: string) => FileInfo | null

export function equals(a: Value, b: Value, findFile?: FindFile): boolean {
  if (isList(a) && isList(b)) {
    return a.length === b.length && a.every((item, i) => equals(item, b[i], findFile))
  }
  if (a instanceof Link || b instanceof Link || a instanceof FileValue || b instanceof FileValue) {
    return linkKey(a, findFile) === linkKey(b, findFile)
  }
  return comparable(a) === comparable(b)
}

function linkKey(value: Value, findFile?: FindFile) {
  if (value instanceof FileValue) return value.file.path.toLowerCase()
  const target = value instanceof Link ? value.target : display(value).replace(/^\[\[|\]\]$/g, '')
  return (findFile?.(target)?.path ?? target).toLowerCase()
}

function toNumber(value: Value): number {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof DateValue) return value.value.valueOf()
  if (value instanceof Duration) return value.ms
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return Number.NaN
}

function asDuration(value: Value) {
  if (value instanceof Duration) return value
  return typeof value === 'string' ? parseDuration(value) : null
}

const shift = (date: DateValue, duration: Duration, sign: number) =>
  new DateValue(
    duration.parts.reduce((result, part) => result.add(sign * part.amount, part.unit), date.value),
    date.hasTime || duration.parts.some(({ unit }) => ['hour', 'minute', 'second'].includes(unit)),
  )

function arithmetic(op: string, a: Value, b: Value): Value {
  if (a instanceof DateValue) {
    const duration = asDuration(b)
    if (duration && (op === '+' || op === '-')) return shift(a, duration, op === '+' ? 1 : -1)
    if (op === '-' && b instanceof DateValue) {
      return new Duration([{ amount: a.value.diff(b.value), unit: 'millisecond' }])
    }
  }
  if (op === '+') {
    if (isList(a) && isList(b)) return [...a, ...b]
    if (typeof a === 'string' || typeof b === 'string') return display(a) + display(b)
  }
  const [x, y] = [toNumber(a), toNumber(b)]
  switch (op) {
    case '+':
      return x + y
    case '-':
      return x - y
    case '*':
      return x * y
    case '/':
      return x / y
    default:
      return x % y
  }
}

// ---------------------------------------------------------------------------------------------
// Evaluation

/** A note seen by a base: its file and its properties. */
export interface Row {
  file: FileInfo
  /** Frontmatter properties, already converted to their types. */
  note: { [key: string]: Value }
}

export interface Scope {
  row: Row
  /** Formula sources by name, for `formula.x`. */
  formulas: Record<string, string>
  /** The base file or the note embedding it, for `this`. */
  current: Row | null
  /** Finds a note by path or link target. */
  findFile: (target: string) => FileInfo | null
  locals?: Record<string, Value>
  /** Formulas being computed, to catch ones that refer to themselves. */
  computing?: Set<string>
}

/** `this`, `note` and `formula`: namespaces that only exist inside expressions. */
class Namespace {
  constructor(
    readonly kind: 'row' | 'note' | 'formula',
    readonly row: Row,
  ) {}
}

type Evaluated = Value | Namespace

function property(row: Row, name: string): Value {
  return row.note[name] ?? null
}

function formula(scope: Scope, row: Row, name: string): Value {
  const source = scope.formulas[name]
  if (source === undefined) return null
  const key = `${row.file.path}\u0000${name}`
  const computing = scope.computing ?? new Set<string>()
  if (computing.has(key)) throw new ExpressionError(`Formula "${name}" refers to itself`)
  computing.add(key)
  try {
    return evaluate(parseExpression(source), { ...scope, row, locals: undefined, computing })
  } finally {
    computing.delete(key)
  }
}

function member(scope: Scope, object: Evaluated, name: string): Evaluated {
  if (object instanceof Namespace) {
    if (object.kind === 'formula') return formula(scope, object.row, name)
    if (object.kind === 'note') return property(object.row, name)
    if (name === 'file') return new FileValue(object.row.file)
    if (name === 'note' || name === 'formula') return new Namespace(name, object.row)
    return property(object.row, name)
  }
  const value = object
  if (typeof value === 'string' && name === 'length') return value.length
  if (isList(value) && name === 'length') return value.length
  if (value instanceof DateValue) {
    const fields: Record<string, number> = {
      year: value.value.year(),
      month: value.value.month() + 1,
      day: value.value.date(),
      hour: value.value.hour(),
      minute: value.value.minute(),
      second: value.value.second(),
      millisecond: value.value.millisecond(),
    }
    if (name in fields) return fields[name]
  }
  if (value instanceof FileValue) return fileField(scope, value.file, name)
  if (isObject(value)) return value[name] ?? null
  return null
}

function fileField(scope: Scope, file: FileInfo, name: string): Value {
  const asFiles = (paths: string[]) => paths.map((path) => new Link(path))
  switch (name) {
    case 'name':
    case 'basename':
    case 'path':
    case 'folder':
    case 'ext':
      return file[name]
    case 'size':
      return file.size
    case 'ctime':
      return new DateValue(dayjs(file.ctime), true)
    case 'mtime':
      return new DateValue(dayjs(file.mtime), true)
    case 'tags':
      return file.tags.map((tag) => `#${tag}`)
    case 'links':
      return asFiles(file.links)
    case 'backlinks':
      return asFiles(file.backlinks)
    case 'embeds':
      return asFiles(file.embeds)
    case 'properties':
      return (scope.findFile(file.path) ?? file).properties as { [key: string]: Value }
    case 'file':
      return new FileValue(file)
    default:
      return null
  }
}

function fileOf(scope: Scope, value: Value): FileInfo | null {
  if (value instanceof FileValue) return value.file
  if (value instanceof Link) return scope.findFile(value.target)
  if (typeof value === 'string')
    return scope.findFile(value.replace(/^\[\[|\]\]$/g, '').split('|')[0])
  return null
}

const TYPE_NAMES = (value: Value) => {
  if (value === null) return 'null'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (value instanceof DateValue) return 'date'
  if (value instanceof Duration) return 'duration'
  if (value instanceof Link) return 'link'
  if (value instanceof FileValue) return 'file'
  if (value instanceof RegExp) return 'regexp'
  if (isList(value)) return 'list'
  return 'object'
}

type Method = (scope: Scope, target: Value, args: Expr[]) => Value

const evaluated = (scope: Scope, args: Expr[]) => args.map((arg) => evaluate(arg, scope))

const containsText = (text: string, query: Value) => text.includes(display(query))

const withLocals = (scope: Scope, locals: Record<string, Value>): Scope => ({
  ...scope,
  locals: { ...scope.locals, ...locals },
})

const flatten = (items: Value[]): Value[] =>
  items.flatMap((item) => (isList(item) ? flatten(item) : [item]))

const ANY_METHODS: Record<string, Method> = {
  isTruthy: (_, target) => isTruthy(target),
  isType: (scope, target, args) => TYPE_NAMES(target) === display(evaluate(args[0], scope)),
  toString: (_scope: Scope, target: Value) => display(target),
  isEmpty: (_, target) => isEmpty(target),
}

const STRING_METHODS: Record<string, (text: string, args: Value[]) => Value> = {
  contains: (text, [query]) => containsText(text, query),
  containsAll: (text, queries) => queries.every((query) => containsText(text, query)),
  containsAny: (text, queries) => queries.some((query) => containsText(text, query)),
  endsWith: (text, [query]) => text.endsWith(display(query)),
  startsWith: (text, [query]) => text.startsWith(display(query)),
  lower: (text) => text.toLowerCase(),
  upper: (text) => text.toUpperCase(),
  replace: (text, [pattern, replacement]) =>
    pattern instanceof RegExp
      ? text.replace(pattern, display(replacement))
      : text.replaceAll(display(pattern), display(replacement)),
  repeat: (text, [count]) => text.repeat(Math.max(0, toNumber(count))),
  reverse: (text) => [...text].reverse().join(''),
  slice: (text, [start, end]) =>
    text.slice(toNumber(start), end === undefined ? undefined : toNumber(end)),
  split: (text, [separator, limit]) =>
    text.split(
      separator instanceof RegExp ? separator : display(separator),
      limit === undefined ? undefined : toNumber(limit),
    ),
  title: (text) =>
    text.replace(/\p{L}[\p{L}']*/gu, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase()),
  trim: (text) => text.trim(),
}

const NUMBER_METHODS: Record<string, (number: number, args: Value[]) => Value> = {
  abs: (number) => Math.abs(number),
  ceil: (number) => Math.ceil(number),
  floor: (number) => Math.floor(number),
  round: (number, [digits]) => {
    const factor = 10 ** (digits === undefined ? 0 : toNumber(digits))
    return Math.round(number * factor) / factor
  },
  toFixed: (number, [precision]) => number.toFixed(toNumber(precision)),
}

const LIST_METHODS: Record<string, Method> = {
  contains: (scope, target, args) =>
    (target as Value[]).some((item) => equals(item, evaluate(args[0], scope), scope.findFile)),
  containsAll: (scope, target, args) =>
    evaluated(scope, args).every((wanted) =>
      (target as Value[]).some((item) => equals(item, wanted, scope.findFile)),
    ),
  containsAny: (scope, target, args) =>
    evaluated(scope, args).some((wanted) =>
      (target as Value[]).some((item) => equals(item, wanted, scope.findFile)),
    ),
  filter: (scope, target, [body]) =>
    (target as Value[]).filter((value, index) =>
      isTruthy(evaluate(body, withLocals(scope, { value, index }))),
    ),
  map: (scope, target, [body]) =>
    (target as Value[]).map((value, index) => evaluate(body, withLocals(scope, { value, index }))),
  reduce: (scope, target, [body, initial]) => {
    let acc = initial ? evaluate(initial, scope) : null
    ;(target as Value[]).forEach((value, index) => {
      acc = evaluate(body, withLocals(scope, { value, index, acc }))
    })
    return acc
  },
  flat: (_, target) => flatten(target as Value[]),
  join: (scope, target, args) =>
    (target as Value[]).map(display).join(display(evaluate(args[0], scope))),
  reverse: (_, target) => [...(target as Value[])].reverse(),
  slice: (scope, target, args) => {
    const [start, end] = evaluated(scope, args)
    return (target as Value[]).slice(toNumber(start), end === undefined ? undefined : toNumber(end))
  },
  sort: (_, target) => [...(target as Value[])].sort(compare),
  unique: (scope, target) =>
    (target as Value[]).filter(
      (item, index, all) => all.findIndex((other) => equals(other, item, scope.findFile)) === index,
    ),
}

const DATE_METHODS: Record<string, (date: DateValue, args: Value[]) => Value> = {
  date: (date) => new DateValue(date.value.startOf('day'), false),
  format: (date, [format]) => date.value.format(display(format)),
  time: (date) => date.value.format('HH:mm:ss'),
  relative: (date) => date.value.fromNow(),
  isEmpty: () => false,
}

function fileMethod(scope: Scope, file: FileInfo, name: string, args: Value[]): Value | undefined {
  switch (name) {
    case 'asLink':
      return new Link(file.path, args[0] === undefined ? null : display(args[0]))
    case 'hasLink': {
      const other = fileOf(scope, args[0])
      return other !== null && file.links.includes(other.path)
    }
    case 'hasProperty':
      return Object.hasOwn(file.properties, display(args[0]))
    case 'hasTag':
      return args.some((tag) => {
        const wanted = display(tag).replace(/^#/, '').toLowerCase()
        return file.tags.some((own) => {
          const lowered = own.toLowerCase()
          return lowered === wanted || lowered.startsWith(`${wanted}/`)
        })
      })
    case 'inFolder': {
      const folder = display(args[0]).replace(/^\/|\/$/g, '')
      return !folder || file.folder === folder || file.folder.startsWith(`${folder}/`)
    }
    default:
      return undefined
  }
}

function callMethod(scope: Scope, target: Value, name: string, args: Expr[]): Value {
  if (isList(target) && name in LIST_METHODS) return LIST_METHODS[name](scope, target, args)
  if (typeof target === 'string' && name in STRING_METHODS) {
    return STRING_METHODS[name](target, evaluated(scope, args))
  }
  if (typeof target === 'number' && name in NUMBER_METHODS) {
    return NUMBER_METHODS[name](target, evaluated(scope, args))
  }
  if (target instanceof DateValue && name in DATE_METHODS) {
    return DATE_METHODS[name](target, evaluated(scope, args))
  }
  if (target instanceof FileValue) {
    const result = fileMethod(scope, target.file, name, evaluated(scope, args))
    if (result !== undefined) return result
  }
  if (target instanceof Link) {
    if (name === 'asFile') {
      const file = scope.findFile(target.target)
      return file ? new FileValue(file) : null
    }
    if (name === 'linksTo') {
      const other = fileOf(scope, evaluate(args[0], scope))
      return other !== null && scope.findFile(target.target)?.path === other.path
    }
  }
  if (target instanceof RegExp && name === 'matches') {
    return target.test(display(evaluate(args[0], scope)))
  }
  if (isObject(target)) {
    if (name === 'keys') return Object.keys(target)
    if (name === 'values') return Object.values(target)
  }
  if (name in ANY_METHODS) return ANY_METHODS[name](scope, target, args)
  throw new ExpressionError(`Unknown function "${name}"`)
}

const GLOBALS: Record<string, Method> = {
  if: (scope, _, [condition, whenTrue, whenFalse]) =>
    isTruthy(evaluate(condition, scope))
      ? evaluate(whenTrue, scope)
      : whenFalse
        ? evaluate(whenFalse, scope)
        : null,
  date: (scope, _, [text]) => {
    const value = evaluate(text, scope)
    return value instanceof DateValue ? value : parseDate(display(value))
  },
  duration: (scope, _, [text]) => parseDuration(display(evaluate(text, scope))),
  file: (scope, _, [target]) => {
    const file = fileOf(scope, evaluate(target, scope))
    return file ? new FileValue(file) : null
  },
  link: (scope, _, [target, text]) => {
    const value = evaluate(target, scope)
    const path = value instanceof FileValue ? value.file.path : display(value)
    return new Link(path, text ? display(evaluate(text, scope)) : null)
  },
  list: (scope, _, [item]) => {
    const value = evaluate(item, scope)
    return isList(value) ? value : [value]
  },
  max: (scope, _, args) => Math.max(...evaluated(scope, args).map(toNumber)),
  min: (scope, _, args) => Math.min(...evaluated(scope, args).map(toNumber)),
  now: () => new DateValue(dayjs(), true),
  today: () => new DateValue(dayjs().startOf('day'), false),
  number: (scope, _, [value]) => toNumber(evaluate(value, scope)),
  random: () => Math.random(),
  escapeHTML: (scope, _, [html]) =>
    display(evaluate(html, scope)).replace(
      /[&<>"']/g,
      (char) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
    ),
  html: (scope, _, [html]) => new Rendered('html', display(evaluate(html, scope))),
  image: (scope, _, [path]) => {
    const value = evaluate(path, scope)
    return new Rendered('image', value instanceof FileValue ? value.file.path : display(value))
  },
  icon: (scope, _, [name]) => new Rendered('icon', display(evaluate(name, scope))),
}

function evaluateName(name: string, scope: Scope): Evaluated {
  if (scope.locals && name in scope.locals) return scope.locals[name]
  switch (name) {
    case 'file':
      return new FileValue(scope.row.file)
    case 'note':
      return new Namespace('note', scope.row)
    case 'formula':
      return new Namespace('formula', scope.row)
    case 'this':
      return scope.current ? new Namespace('row', scope.current) : null
    default:
      return property(scope.row, name)
  }
}

function evaluateTarget(expr: Expr, scope: Scope): Evaluated {
  if (expr.kind === 'name') return evaluateName(expr.name, scope)
  if (expr.kind === 'member') return member(scope, evaluateTarget(expr.object, scope), expr.name)
  return evaluate(expr, scope)
}

function valueOf(evaluatedValue: Evaluated): Value {
  if (!(evaluatedValue instanceof Namespace)) return evaluatedValue
  if (evaluatedValue.kind === 'note') return evaluatedValue.row.note
  return new FileValue(evaluatedValue.row.file)
}

export function evaluate(expr: Expr, scope: Scope): Value {
  switch (expr.kind) {
    case 'literal':
      return expr.value
    case 'name':
    case 'member':
      return valueOf(evaluateTarget(expr, scope))
    case 'index': {
      const object = evaluateTarget(expr.object, scope)
      const index = evaluate(expr.index, scope)
      if (object instanceof Namespace) return valueOf(member(scope, object, display(index)))
      if (isList(object))
        return (
          object[toNumber(index) < 0 ? object.length + toNumber(index) : toNumber(index)] ?? null
        )
      if (typeof object === 'string') return object[toNumber(index)] ?? null
      return valueOf(member(scope, object, display(index)))
    }
    case 'list':
      return expr.items.map((item) => evaluate(item, scope))
    case 'unary': {
      const value = evaluate(expr.operand, scope)
      return expr.op === '!' ? !isTruthy(value) : -toNumber(value)
    }
    case 'call': {
      if (expr.callee.kind === 'name' && !(scope.locals && expr.callee.name in scope.locals)) {
        const global = GLOBALS[expr.callee.name]
        if (!global) throw new ExpressionError(`Unknown function "${expr.callee.name}"`)
        return global(scope, null, expr.args)
      }
      if (expr.callee.kind === 'member') {
        const target = valueOf(evaluateTarget(expr.callee.object, scope))
        return callMethod(scope, target, expr.callee.name, expr.args)
      }
      throw new ExpressionError('Only functions can be called')
    }
    case 'binary': {
      if (expr.op === '&&')
        return isTruthy(evaluate(expr.left, scope)) && isTruthy(evaluate(expr.right, scope))
      if (expr.op === '||')
        return isTruthy(evaluate(expr.left, scope)) || isTruthy(evaluate(expr.right, scope))
      const left = evaluate(expr.left, scope)
      const right = evaluate(expr.right, scope)
      switch (expr.op) {
        case '==':
          return equals(left, right, scope.findFile)
        case '!=':
          return !equals(left, right, scope.findFile)
        case '<':
          return compare(left, right) < 0 && left !== null && right !== null
        case '>':
          return compare(left, right) > 0 && left !== null && right !== null
        case '<=':
          return compare(left, right) <= 0 && left !== null && right !== null
        case '>=':
          return compare(left, right) >= 0 && left !== null && right !== null
        default:
          return arithmetic(expr.op, left, right)
      }
    }
  }
}

/** Evaluates `source` for a row; a broken expression reads as an error message instead. */
export function run(source: string, scope: Scope): Value | ExpressionError {
  try {
    return evaluate(parseExpression(source), scope)
  } catch (error) {
    return error instanceof ExpressionError ? error : new ExpressionError(String(error))
  }
}
