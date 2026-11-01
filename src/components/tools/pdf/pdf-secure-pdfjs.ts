/**
 * pdf.js configuration for the `pdf-secure` batch. Import this module
 * dynamically (`const { pdfjs } = await import('./pdf-secure-pdfjs')`) so the
 * renderer and its worker stay out of the initial island bundle.
 *
 * The worker URL is resolved by the bundler at build time, so it is served
 * from our own origin — nothing is fetched from a CDN.
 */
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export { pdfjs }
