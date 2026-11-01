// Dev server for smoke runs: the site config with HMR off, so edits made
// while a run is in progress do not reload pages mid-test (changes still apply
// on the next navigation), and with every component scanned for dependencies
// up front, so Vite does not re-bundle (and answer 504) halfway through a run.
//   npx astro dev --port 46220 --config scripts/smoke/astro.dev.config.mjs
import base from '../../astro.config.mjs'

export default {
  ...base,
  vite: {
    ...base.vite,
    server: { ...base.vite?.server, hmr: false },
    optimizeDeps: {
      ...base.vite?.optimizeDeps,
      entries: ['src/components/**/*.tsx', 'src/lib/**/*.ts'],
    },
  },
}
