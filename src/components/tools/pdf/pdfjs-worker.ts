/**
 * Single place that configures pdf.js. Import this module dynamically
 * (`const { pdfjs } = await import('./pdfjs-worker')`) so the ~350 kB renderer
 * and its worker stay out of the initial island bundle.
 */
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export { pdfjs }
