import type { ComponentType } from 'react'
import * as Lucide from 'lucide-react'
import type { LucideProps } from 'lucide-react'

/**
 * Registry-driven lucide icon resolver.
 *
 * The tool registry stores icons as PascalCase strings (`"FileStack"`). This
 * component maps that string to the matching `lucide-react` export so an
 * unknown or misspelled name degrades to a neutral glyph instead of breaking
 * the build.
 *
 * The whole namespace is used (rather than the `icons` record) because it also
 * carries lucide's alias exports — `Code2`, `AlertTriangle`, `Settings2` and
 * friends — which the `icons` record omits.
 *
 * IMPORTANT: this pulls the entire lucide icon set, so it is meant for
 * **server-rendered Astro usage only** (no `client:*` directive). Client
 * islands should import the handful of icons they need by name instead.
 */
type Glyph = ComponentType<LucideProps>

const NON_ICON_EXPORTS = new Set(['createLucideIcon', 'icons', 'default', 'Icon'])

const REGISTRY = Lucide as unknown as Record<string, Glyph | undefined>

const FALLBACK: Glyph = Lucide.Wrench

/** "file-stack" / "file_stack" / "fileStack" -> "FileStack" */
function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr: string | undefined) => (chr ? chr.toUpperCase() : ''))
    .replace(/^[a-z]/, (chr) => chr.toUpperCase())
}

function lookup(name: string): Glyph | undefined {
  if (NON_ICON_EXPORTS.has(name)) return undefined
  const candidate = REGISTRY[name]
  return typeof candidate === 'function' || (candidate && typeof candidate === 'object')
    ? candidate
    : undefined
}

export function resolveIcon(name: string | undefined): Glyph {
  if (name) {
    const direct = lookup(name)
    if (direct) return direct
    const pascal = lookup(toPascalCase(name))
    if (pascal) return pascal
    const suffixed = lookup(`${toPascalCase(name)}Icon`)
    if (suffixed) return suffixed
  }
  return FALLBACK
}

export interface IconProps extends Omit<LucideProps, 'ref'> {
  /** PascalCase lucide export name, e.g. "FileStack". */
  name: string
}

export default function Icon({ name, strokeWidth = 1.75, ...rest }: IconProps) {
  const Resolved = resolveIcon(name)
  return <Resolved aria-hidden="true" focusable="false" strokeWidth={strokeWidth} {...rest} />
}
