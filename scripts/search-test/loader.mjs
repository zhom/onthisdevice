/**
 * Lets Node run the site's TypeScript for the search tests: resolves `@/x` to src/x and
 * extensionless imports inside src, as Vite does. Node strips the types itself.
 */
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = path.join(ROOT, 'src')

registerHooks({
  resolve(spec, ctx, next) {
    let target = null
    if (spec.startsWith('@/')) target = path.join(SRC, spec.slice(2))
    else if (/^\.\.?\//.test(spec) && ctx.parentURL?.startsWith(pathToFileURL(SRC).href)) {
      target = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec)
    }
    if (target) {
      if (/\.(ts|tsx|mjs|js|json)$/.test(target) && existsSync(target)) {
        return { url: pathToFileURL(target).href, shortCircuit: true }
      }
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        if (existsSync(target + ext)) return { url: pathToFileURL(target + ext).href, shortCircuit: true }
      }
    }
    return next(spec, ctx)
  },
})
