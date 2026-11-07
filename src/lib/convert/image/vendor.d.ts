/** Types for the two image libraries that ship without them. */

declare module 'gifenc' {
  export type Palette = number[][]
  export type ColorFormat = 'rgb565' | 'rgb444' | 'rgba4444'
  export interface QuantizeOptions {
    format?: ColorFormat
    oneBitAlpha?: boolean | number
    clearAlpha?: boolean
    clearAlphaThreshold?: number
    clearAlphaColor?: number
  }
  export interface WriteFrameOptions {
    palette?: Palette | null
    delay?: number
    transparent?: boolean
    transparentIndex?: number
    repeat?: number
    dispose?: number
  }
  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void
    finish(): void
    bytes(): Uint8Array
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: QuantizeOptions): Palette
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: ColorFormat): Uint8Array
}

declare module 'imagetracerjs' {
  export interface TraceOptions {
    numberofcolors?: number
    colorsampling?: 0 | 1 | 2
    colorquantcycles?: number
    ltres?: number
    qtres?: number
    pathomit?: number
    rightangleenhance?: boolean
    blurradius?: number
    blurdelta?: number
    strokewidth?: number
    linefilter?: boolean
    scale?: number
    roundcoords?: number
    viewbox?: boolean
    desc?: boolean
    mincolorratio?: number
  }
  export interface TracerImageData {
    width: number
    height: number
    data: Uint8ClampedArray | Uint8Array
  }
  const ImageTracer: {
    imagedataToSVG(imgd: TracerImageData, options?: TraceOptions | string): string
  }
  export default ImageTracer
}
