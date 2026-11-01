/**
 * Structural type inference from a JSON sample, plus six code emitters, for the
 * `dev-format` batch.
 *
 * The inference step is shared by every target: parse → build a shape tree →
 * merge shapes across array elements and unions → name the object shapes →
 * emit. Nothing here calls out to quicktype or any other library; the whole
 * pipeline is ~500 lines of plain TypeScript so it can run instantly on a
 * paste, offline.
 */

export type CodeTarget = 'typescript' | 'go' | 'zod' | 'json-schema' | 'python' | 'csharp'

export interface CodeTargetInfo {
  id: CodeTarget
  label: string
  language: string
  extension: string
}

export const CODE_TARGETS: CodeTargetInfo[] = [
  { id: 'typescript', label: 'TypeScript interfaces', language: 'ts', extension: 'ts' },
  { id: 'go', label: 'Go structs', language: 'go', extension: 'go' },
  { id: 'zod', label: 'Zod schema', language: 'ts', extension: 'ts' },
  { id: 'json-schema', label: 'JSON Schema', language: 'json', extension: 'json' },
  { id: 'python', label: 'Python dataclasses', language: 'py', extension: 'py' },
  { id: 'csharp', label: 'C# classes', language: 'cs', extension: 'cs' },
]

/* ------------------------------------------------------------------ */
/* Shape inference                                                     */
/* ------------------------------------------------------------------ */

export type Shape =
  | { kind: 'unknown' }
  | { kind: 'null' }
  | { kind: 'string' }
  | { kind: 'integer' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'array'; element: Shape }
  | { kind: 'object'; fields: Map<string, ShapeField>; count: number }
  | { kind: 'union'; options: Shape[] }

export interface ShapeField {
  shape: Shape
  /** How many of the merged samples carried this key. */
  present: number
}

function shapeOf(value: unknown): Shape {
  if (value === null) return { kind: 'null' }
  if (Array.isArray(value)) {
    let element: Shape = { kind: 'unknown' }
    for (const item of value) element = mergeShapes(element, shapeOf(item))
    return { kind: 'array', element }
  }
  switch (typeof value) {
    case 'string':
      return { kind: 'string' }
    case 'number':
      return Number.isInteger(value) ? { kind: 'integer' } : { kind: 'number' }
    case 'boolean':
      return { kind: 'boolean' }
    case 'object': {
      const fields = new Map<string, ShapeField>()
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        fields.set(key, { shape: shapeOf(child), present: 1 })
      }
      return { kind: 'object', fields, count: 1 }
    }
    default:
      return { kind: 'unknown' }
  }
}

function unionise(options: Shape[]): Shape {
  const flat: Shape[] = []
  for (const option of options) {
    if (option.kind === 'union') flat.push(...option.options)
    else if (option.kind !== 'unknown') flat.push(option)
  }
  const out: Shape[] = []
  for (const option of flat) {
    if (!out.some((existing) => sameShape(existing, option))) out.push(option)
  }
  if (out.length === 0) return { kind: 'unknown' }
  if (out.length === 1) return out[0]
  return { kind: 'union', options: out }
}

export function mergeShapes(a: Shape, b: Shape): Shape {
  if (a.kind === 'unknown') return b
  if (b.kind === 'unknown') return a
  if (a.kind === 'integer' && b.kind === 'number') return { kind: 'number' }
  if (a.kind === 'number' && b.kind === 'integer') return { kind: 'number' }
  if (a.kind === b.kind) {
    if (a.kind === 'array' && b.kind === 'array') {
      return { kind: 'array', element: mergeShapes(a.element, b.element) }
    }
    if (a.kind === 'object' && b.kind === 'object') {
      const fields = new Map<string, ShapeField>()
      const keys = new Set([...a.fields.keys(), ...b.fields.keys()])
      for (const key of keys) {
        const left = a.fields.get(key)
        const right = b.fields.get(key)
        if (left && right) {
          fields.set(key, {
            shape: mergeShapes(left.shape, right.shape),
            present: left.present + right.present,
          })
        } else {
          const only = (left ?? right) as ShapeField
          fields.set(key, { shape: only.shape, present: only.present })
        }
      }
      return { kind: 'object', fields, count: a.count + b.count }
    }
    return a
  }
  return unionise([a, b])
}

function sameShape(a: Shape, b: Shape): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'array' && b.kind === 'array') return sameShape(a.element, b.element)
  if (a.kind === 'object' && b.kind === 'object') {
    if (a.fields.size !== b.fields.size) return false
    for (const [key, field] of a.fields) {
      const other = b.fields.get(key)
      if (!other || !sameShape(field.shape, other.shape)) return false
    }
    return true
  }
  if (a.kind === 'union' && b.kind === 'union') {
    if (a.options.length !== b.options.length) return false
    return a.options.every((option, i) => sameShape(option, b.options[i]))
  }
  return true
}

/* ------------------------------------------------------------------ */
/* Naming                                                              */
/* ------------------------------------------------------------------ */

const IRREGULAR: Record<string, string> = {
  children: 'child',
  people: 'person',
  data: 'datum',
  media: 'medium',
  criteria: 'criterion',
  indices: 'index',
  matrices: 'matrix',
  addresses: 'address',
  statuses: 'status',
}

export function singularise(word: string): string {
  const lower = word.toLowerCase()
  if (IRREGULAR[lower]) return IRREGULAR[lower]
  if (/[^aeiou]ies$/i.test(word)) return word.slice(0, -3) + 'y'
  if (/(ches|shes|sses|xes|zes)$/i.test(word)) return word.slice(0, -2)
  if (/[^s]s$/i.test(word)) return word.slice(0, -1)
  return word
}

export function pascalCase(input: string): string {
  const parts = input
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'Value'
  const joined = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
  return /^[0-9]/.test(joined) ? `N${joined}` : joined
}

export function camelCase(input: string): string {
  const pascal = pascalCase(input)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export function snakeCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

/** Go convention: ID not Id, URL not Url. */
const GO_INITIALISMS = new Set([
  'ID',
  'URL',
  'URI',
  'API',
  'HTTP',
  'HTTPS',
  'JSON',
  'XML',
  'HTML',
  'SQL',
  'UUID',
  'IP',
  'TLS',
  'SSH',
  'CPU',
  'RAM',
  'UTC',
  'EOF',
  'DB',
  'OS',
  'TTL',
])

export function goName(input: string): string {
  const parts = input
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'Field'
  const joined = parts
    .map((part) => {
      const upper = part.toUpperCase()
      if (GO_INITIALISMS.has(upper)) return upper
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('')
  return /^[0-9]/.test(joined) ? `F${joined}` : joined
}

/** Every named object shape found in the tree, in dependency order. */
export interface NamedShape {
  name: string
  shape: Extract<Shape, { kind: 'object' }>
}

interface NamingState {
  named: NamedShape[]
  byShape: { shape: Shape; name: string }[]
  used: Set<string>
}

function uniqueName(state: NamingState, base: string): string {
  let name = base
  let n = 2
  while (state.used.has(name)) {
    name = `${base}${n}`
    n += 1
  }
  state.used.add(name)
  return name
}

/**
 * Walks the shape tree depth-first, giving every object shape a name derived
 * from the key that holds it and reusing one name for structurally identical
 * shapes.
 */
export function nameShapes(root: Shape, rootName: string): NamedShape[] {
  const state: NamingState = { named: [], byShape: [], used: new Set() }

  const visit = (shape: Shape, hint: string): void => {
    if (shape.kind === 'array') {
      visit(shape.element, singularise(hint))
      return
    }
    if (shape.kind === 'union') {
      for (const option of shape.options) visit(option, hint)
      return
    }
    if (shape.kind !== 'object') return
    if (shape.fields.size === 0) return
    if (state.byShape.some((entry) => sameShape(entry.shape, shape))) return

    // Name children first so dependencies are declared before their users.
    for (const [key, field] of shape.fields) visit(field.shape, key)

    const name = uniqueName(state, pascalCase(hint))
    state.byShape.push({ shape, name })
    state.named.push({ name, shape })
  }

  visit(root, rootName)
  return state.named
}

function nameOf(named: NamedShape[], shape: Shape): string | null {
  for (const entry of named) if (sameShape(entry.shape, shape)) return entry.name
  return null
}

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export interface CodegenOptions {
  rootName: string
  /** Treat a key missing from some array elements as optional. */
  markOptional: boolean
  /** Emit `| null` / pointers / Optional[...] where a null was seen. */
  nullable: boolean
  /** Add `export` / `public` / `pub` where the language has one. */
  exported: boolean
  /** TypeScript: `interface` (default) or `type`. */
  tsDeclaration: 'interface' | 'type'
  /** Emit a short header comment naming the tool. */
  header: boolean
}

export const DEFAULT_CODEGEN: CodegenOptions = {
  rootName: 'Root',
  markOptional: true,
  nullable: true,
  exported: true,
  tsDeclaration: 'interface',
  header: false,
}

export interface CodegenResult {
  code: string
  /** Interfaces / structs / classes produced. */
  typeCount: number
  warnings: string[]
}

/* ------------------------------------------------------------------ */
/* Emitters                                                            */
/* ------------------------------------------------------------------ */

const VALID_TS_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function collectWarnings(root: Shape, named: NamedShape[]): string[] {
  const warnings: string[] = []
  let emptyArrays = 0
  let mixedArrays = 0
  const walk = (shape: Shape): void => {
    if (shape.kind === 'array') {
      if (shape.element.kind === 'unknown') emptyArrays += 1
      if (shape.element.kind === 'union') mixedArrays += 1
      walk(shape.element)
      return
    }
    if (shape.kind === 'object') {
      for (const field of shape.fields.values()) walk(field.shape)
      return
    }
    if (shape.kind === 'union') {
      for (const option of shape.options) walk(option)
    }
  }
  walk(root)
  if (emptyArrays > 0) {
    warnings.push(
      `${emptyArrays} array${emptyArrays === 1 ? ' was' : 's were'} empty in this sample, so the element type is unknown. Paste a sample that includes at least one element.`,
    )
  }
  if (mixedArrays > 0) {
    warnings.push(
      `${mixedArrays} array${mixedArrays === 1 ? ' mixes' : 's mix'} more than one shape, so the element type is a union. Check that this is intentional and not two different responses pasted together.`,
    )
  }
  if (named.length > 40) {
    warnings.push(
      `${named.length} types were generated. Large samples produce large output. Generate from one typical record instead of a full page of results.`,
    )
  }
  warnings.push(
    'Generated types describe the sample you pasted, not the contract the API promises. A field that happens to be non-null here may be nullable in production. Check the API documentation before you commit.',
  )
  return warnings
}

/* -------------------------- TypeScript ---------------------------- */

function tsType(shape: Shape, named: NamedShape[], options: CodegenOptions): string {
  switch (shape.kind) {
    case 'string':
      return 'string'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    case 'unknown':
      return 'unknown'
    case 'array': {
      const inner = tsType(shape.element, named, options)
      return /[|&\s]/.test(inner) ? `(${inner})[]` : `${inner}[]`
    }
    case 'object': {
      const name = nameOf(named, shape)
      if (name) return name
      return 'Record<string, unknown>'
    }
    case 'union':
      return shape.options.map((option) => tsType(option, named, options)).join(' | ')
    default:
      return 'unknown'
  }
}

function emitTypeScript(root: Shape, named: NamedShape[], options: CodegenOptions): string {
  const lines: string[] = []
  if (options.header) {
    lines.push('// Generated from a JSON sample by onthisdevice.com/json-to-typescript', '')
  }
  const prefix = options.exported ? 'export ' : ''

  for (const entry of named) {
    const body: string[] = []
    for (const [key, field] of entry.shape.fields) {
      const optional = options.markOptional && field.present < entry.shape.count
      const safeKey = VALID_TS_KEY.test(key) ? key : JSON.stringify(key)
      body.push(`  ${safeKey}${optional ? '?' : ''}: ${tsType(field.shape, named, options)}`)
    }
    if (options.tsDeclaration === 'interface') {
      lines.push(`${prefix}interface ${entry.name} {`, ...body, '}', '')
    } else {
      lines.push(`${prefix}type ${entry.name} = {`, ...body, '}', '')
    }
  }

  if (root.kind !== 'object' || named.length === 0) {
    lines.push(`${prefix}type ${pascalCase(options.rootName)} = ${tsType(root, named, options)}`, '')
  } else if (nameOf(named, root) !== pascalCase(options.rootName)) {
    const rootType = tsType(root, named, options)
    if (rootType !== pascalCase(options.rootName)) {
      lines.push(`${prefix}type ${pascalCase(options.rootName)} = ${rootType}`, '')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}

/* ------------------------------ Go -------------------------------- */

function goType(shape: Shape, named: NamedShape[], options: CodegenOptions): string {
  switch (shape.kind) {
    case 'string':
      return 'string'
    case 'integer':
      return 'int64'
    case 'number':
      return 'float64'
    case 'boolean':
      return 'bool'
    case 'null':
      return 'any'
    case 'unknown':
      return 'any'
    case 'array':
      return `[]${goType(shape.element, named, options)}`
    case 'object': {
      const name = nameOf(named, shape)
      return name ?? 'map[string]any'
    }
    case 'union': {
      const withoutNull = shape.options.filter((option) => option.kind !== 'null')
      if (withoutNull.length === 1 && options.nullable) {
        const inner = goType(withoutNull[0], named, options)
        return inner.startsWith('[]') || inner.startsWith('map[') ? inner : `*${inner}`
      }
      return 'any'
    }
    default:
      return 'any'
  }
}

function emitGo(root: Shape, named: NamedShape[], options: CodegenOptions): string {
  const lines: string[] = []
  if (options.header) {
    lines.push('// Generated from a JSON sample by onthisdevice.com/json-to-go', '')
  }
  lines.push('package main', '')

  const render = (name: string, shape: Extract<Shape, { kind: 'object' }>): void => {
    const rows: [string, string, string][] = []
    for (const [key, field] of shape.fields) {
      const optional = options.markOptional && field.present < shape.count
      const tag = `\`json:"${key}${optional ? ',omitempty' : ''}"\``
      rows.push([goName(key), goType(field.shape, named, options), tag])
    }
    const nameWidth = Math.max(0, ...rows.map((r) => r[0].length))
    const typeWidth = Math.max(0, ...rows.map((r) => r[1].length))
    lines.push(`type ${name} struct {`)
    for (const [fieldName, fieldType, tag] of rows) {
      lines.push(`\t${fieldName.padEnd(nameWidth)} ${fieldType.padEnd(typeWidth)} ${tag}`)
    }
    lines.push('}', '')
  }

  for (const entry of named) render(entry.name, entry.shape)

  if (root.kind !== 'object' || named.length === 0) {
    lines.push(`type ${goName(options.rootName)} ${goType(root, named, options)}`, '')
  }

  return lines.join('\n').trimEnd() + '\n'
}

/* ----------------------------- Zod -------------------------------- */

function zodType(shape: Shape, named: NamedShape[], options: CodegenOptions): string {
  switch (shape.kind) {
    case 'string':
      return 'z.string()'
    case 'integer':
      return 'z.number().int()'
    case 'number':
      return 'z.number()'
    case 'boolean':
      return 'z.boolean()'
    case 'null':
      return 'z.null()'
    case 'unknown':
      return 'z.unknown()'
    case 'array':
      return `z.array(${zodType(shape.element, named, options)})`
    case 'object': {
      const name = nameOf(named, shape)
      return name ? `${camelCase(name)}Schema` : 'z.record(z.string(), z.unknown())'
    }
    case 'union': {
      const withoutNull = shape.options.filter((option) => option.kind !== 'null')
      const hadNull = withoutNull.length !== shape.options.length
      if (withoutNull.length === 0) return 'z.null()'
      const base =
        withoutNull.length === 1
          ? zodType(withoutNull[0], named, options)
          : `z.union([${withoutNull.map((o) => zodType(o, named, options)).join(', ')}])`
      return hadNull && options.nullable ? `${base}.nullable()` : base
    }
    default:
      return 'z.unknown()'
  }
}

function emitZod(root: Shape, named: NamedShape[], options: CodegenOptions): string {
  const lines: string[] = []
  if (options.header) {
    lines.push('// Generated from a JSON sample by onthisdevice.com/json-to-zod-schema', '')
  }
  lines.push("import { z } from 'zod'", '')
  const prefix = options.exported ? 'export ' : ''

  for (const entry of named) {
    lines.push(`${prefix}const ${camelCase(entry.name)}Schema = z.object({`)
    for (const [key, field] of entry.shape.fields) {
      const optional = options.markOptional && field.present < entry.shape.count
      const safeKey = VALID_TS_KEY.test(key) ? key : JSON.stringify(key)
      lines.push(
        `  ${safeKey}: ${zodType(field.shape, named, options)}${optional ? '.optional()' : ''},`,
      )
    }
    lines.push('})', '')
  }

  const rootSchema = zodType(root, named, options)
  const rootTypeName = pascalCase(options.rootName)
  if (root.kind === 'object' && nameOf(named, root)) {
    const schemaName = `${camelCase(nameOf(named, root) ?? rootTypeName)}Schema`
    lines.push(`${prefix}type ${rootTypeName} = z.infer<typeof ${schemaName}>`, '')
  } else {
    lines.push(`${prefix}const ${camelCase(rootTypeName)}Schema = ${rootSchema}`)
    lines.push(
      `${prefix}type ${rootTypeName} = z.infer<typeof ${camelCase(rootTypeName)}Schema>`,
      '',
    )
  }

  return lines.join('\n').trimEnd() + '\n'
}

/* -------------------------- JSON Schema --------------------------- */

type SchemaNode = Record<string, unknown>

function jsonSchemaOf(shape: Shape, options: CodegenOptions): SchemaNode {
  switch (shape.kind) {
    case 'string':
      return { type: 'string' }
    case 'integer':
      return { type: 'integer' }
    case 'number':
      return { type: 'number' }
    case 'boolean':
      return { type: 'boolean' }
    case 'null':
      return { type: 'null' }
    case 'unknown':
      return {}
    case 'array':
      return { type: 'array', items: jsonSchemaOf(shape.element, options) }
    case 'object': {
      const properties: Record<string, SchemaNode> = {}
      const required: string[] = []
      for (const [key, field] of shape.fields) {
        properties[key] = jsonSchemaOf(field.shape, options)
        if (!options.markOptional || field.present === shape.count) required.push(key)
      }
      const node: SchemaNode = { type: 'object', properties }
      if (required.length > 0) node.required = required
      node.additionalProperties = false
      return node
    }
    case 'union': {
      const simple = shape.options.every(
        (option) =>
          option.kind === 'string' ||
          option.kind === 'number' ||
          option.kind === 'integer' ||
          option.kind === 'boolean' ||
          option.kind === 'null',
      )
      if (simple) {
        const names = shape.options.map((option) =>
          option.kind === 'integer' ? 'integer' : option.kind,
        )
        return { type: Array.from(new Set(names)) }
      }
      return { anyOf: shape.options.map((option) => jsonSchemaOf(option, options)) }
    }
    default:
      return {}
  }
}

function emitJsonSchema(root: Shape, options: CodegenOptions): string {
  const schema: SchemaNode = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: pascalCase(options.rootName),
    ...jsonSchemaOf(root, options),
  }
  return JSON.stringify(schema, null, 2) + '\n'
}

/* ---------------------------- Python ------------------------------ */

const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import',
  'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
  'with', 'yield',
])

function pythonType(shape: Shape, named: NamedShape[], options: CodegenOptions): string {
  switch (shape.kind) {
    case 'string':
      return 'str'
    case 'integer':
      return 'int'
    case 'number':
      return 'float'
    case 'boolean':
      return 'bool'
    case 'null':
      return 'None'
    case 'unknown':
      return 'Any'
    case 'array':
      return `list[${pythonType(shape.element, named, options)}]`
    case 'object': {
      const name = nameOf(named, shape)
      return name ?? 'dict[str, Any]'
    }
    case 'union': {
      const withoutNull = shape.options.filter((option) => option.kind !== 'null')
      const hadNull = withoutNull.length !== shape.options.length
      if (withoutNull.length === 0) return 'None'
      const base = withoutNull.map((option) => pythonType(option, named, options)).join(' | ')
      return hadNull && options.nullable ? `${base} | None` : base
    }
    default:
      return 'Any'
  }
}

function emitPython(root: Shape, named: NamedShape[], options: CodegenOptions): string {
  const lines: string[] = []
  if (options.header) {
    lines.push('# Generated from a JSON sample by onthisdevice.com/json-to-python-dataclass', '')
  }
  lines.push(
    'from __future__ import annotations',
    '',
    'from dataclasses import dataclass, field',
    'from typing import Any',
    '',
    '',
  )

  for (const entry of named) {
    lines.push('@dataclass')
    lines.push(`class ${entry.name}:`)
    const required: string[] = []
    const optional: string[] = []
    for (const [key, fieldShape] of entry.shape.fields) {
      let attribute = snakeCase(key) || 'value'
      if (PYTHON_KEYWORDS.has(attribute)) attribute += '_'
      const type = pythonType(fieldShape.shape, named, options)
      const isOptional = options.markOptional && fieldShape.present < entry.shape.count
      const alias =
        attribute !== key ? `  # JSON key: "${key}"` : ''
      if (isOptional) {
        const nullableType = type.includes('None') ? type : `${type} | None`
        optional.push(`    ${attribute}: ${nullableType} = None${alias}`)
      } else if (type.startsWith('list[')) {
        required.push(`    ${attribute}: ${type}${alias}`)
      } else {
        required.push(`    ${attribute}: ${type}${alias}`)
      }
    }
    if (required.length === 0 && optional.length === 0) lines.push('    pass')
    lines.push(...required, ...optional)
    lines.push('', '')
  }

  if (root.kind !== 'object' || named.length === 0) {
    lines.push(`${pascalCase(options.rootName)} = ${pythonType(root, named, options)}`, '')
  }

  const code = lines.join('\n').replace(/\n{3,}$/, '\n')
  return code.includes('field(') ? code : code.replace('from dataclasses import dataclass, field', 'from dataclasses import dataclass')
}

/* ------------------------------ C# -------------------------------- */

function csharpType(shape: Shape, named: NamedShape[], options: CodegenOptions): string {
  switch (shape.kind) {
    case 'string':
      return 'string'
    case 'integer':
      return 'long'
    case 'number':
      return 'double'
    case 'boolean':
      return 'bool'
    case 'null':
      return 'object?'
    case 'unknown':
      return 'object?'
    case 'array':
      return `List<${csharpType(shape.element, named, options)}>`
    case 'object': {
      const name = nameOf(named, shape)
      return name ?? 'Dictionary<string, object?>'
    }
    case 'union': {
      const withoutNull = shape.options.filter((option) => option.kind !== 'null')
      if (withoutNull.length === 1) {
        const inner = csharpType(withoutNull[0], named, options)
        return options.nullable && !inner.endsWith('?') ? `${inner}?` : inner
      }
      return 'object?'
    }
    default:
      return 'object?'
  }
}

function emitCsharp(root: Shape, named: NamedShape[], options: CodegenOptions): string {
  const lines: string[] = []
  if (options.header) {
    lines.push('// Generated from a JSON sample by onthisdevice.com/json-to-csharp', '')
  }
  lines.push(
    'using System.Collections.Generic;',
    'using System.Text.Json.Serialization;',
    '',
  )

  const visibility = options.exported ? 'public ' : 'internal '

  for (const entry of named) {
    lines.push(`${visibility}class ${entry.name}`)
    lines.push('{')
    const rows: string[] = []
    for (const [key, field] of entry.shape.fields) {
      const optional = options.markOptional && field.present < entry.shape.count
      let type = csharpType(field.shape, named, options)
      if (optional && options.nullable && !type.endsWith('?')) type += '?'
      let property = pascalCase(key)
      if (property === entry.name) property += 'Value'
      rows.push(`    [JsonPropertyName("${key}")]`)
      rows.push(`    public ${type} ${property} { get; set; }`)
      rows.push('')
    }
    if (rows.length > 0) rows.pop()
    lines.push(...rows)
    lines.push('}', '')
  }

  if (root.kind !== 'object' || named.length === 0) {
    lines.push(
      `// Root value is not an object: ${csharpType(root, named, options)}`,
      '',
    )
  }

  return lines.join('\n').trimEnd() + '\n'
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function generateCode(
  value: unknown,
  target: CodeTarget,
  options: CodegenOptions,
): CodegenResult {
  const root = shapeOf(value)
  const named = nameShapes(root, options.rootName || 'Root')
  const warnings = collectWarnings(root, named)

  let code: string
  switch (target) {
    case 'typescript':
      code = emitTypeScript(root, named, options)
      break
    case 'go':
      code = emitGo(root, named, options)
      break
    case 'zod':
      code = emitZod(root, named, options)
      break
    case 'json-schema':
      code = emitJsonSchema(root, options)
      break
    case 'python':
      code = emitPython(root, named, options)
      break
    case 'csharp':
      code = emitCsharp(root, named, options)
      break
    default:
      code = ''
  }

  return { code, typeCount: named.length, warnings }
}

export const CODEGEN_SAMPLE = `{
  "id": 10482,
  "reference": "A-10482",
  "paid": true,
  "total_amount": 138.5,
  "discount_code": null,
  "customer": {
    "id": 771,
    "full_name": "Ada Lovelace",
    "email": "ada@example.com",
    "tags": ["vip", "beta"]
  },
  "line_items": [
    { "sku": "KB-01", "quantity": 1, "unit_price": 89.5 },
    { "sku": "MS-14", "quantity": 2, "unit_price": 24.5, "gift_wrap": true }
  ],
  "placed_at": "2026-08-14T09:12:33Z"
}`
