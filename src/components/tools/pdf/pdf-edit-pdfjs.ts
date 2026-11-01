/**
 * Round-2 batch `pdf-edit` — pdf.js configuration.
 *
 * Import this module dynamically so the renderer and its worker stay out of
 * the initial island bundle. The worker is bundled by Vite from node_modules,
 * so it is served same-origin; nothing is fetched from a CDN.
 */
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export { pdfjs }
