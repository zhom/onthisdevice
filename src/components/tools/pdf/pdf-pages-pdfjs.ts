/**
 * pdf.js configuration for the round-2 `pdf-pages` batch.
 *
 * Import this dynamically (`const { pdfjs } = await import('./pdf-pages-pdfjs')`)
 * so the renderer and its worker stay out of the initial island bundle. The
 * worker is bundled by Vite from a local URL — nothing is fetched from a CDN.
 */
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export { pdfjs }
