/** Thin, lazily-loaded wrapper around mammoth with human-readable errors. */

type Mammoth = typeof import('mammoth')

let cached: Mammoth | null = null

async function loadMammoth(): Promise<Mammoth> {
  if (!cached) {
    const mod = (await import('mammoth')) as unknown as Mammoth & { default?: Mammoth }
    cached = mod.default ?? mod
  }
  return cached
}

export interface DocxOutput {
  value: string
  warnings: string[]
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

function describeFailure(error: unknown, fileName: string): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (/central directory|end of central|not a zip|Corrupted zip/i.test(message)) {
    return new Error(
      `“${fileName}” isn’t a valid .docx file. Word’s older .doc format and password-protected documents can’t be read. Open it in Word and “Save as” .docx first.`,
    )
  }
  if (/password|encrypt/i.test(message)) {
    return new Error(`“${fileName}” is password-protected. Remove the password in Word, then try again.`)
  }
  return new Error(`Could not read “${fileName}”: ${message}`)
}

async function checkDocx(file: File): Promise<ArrayBuffer> {
  const buffer = await file.arrayBuffer()
  const head = new Uint8Array(buffer.slice(0, 4))
  if (!ZIP_MAGIC.every((b, i) => head[i] === b)) {
    if (head[0] === 0xd0 && head[1] === 0xcf) {
      throw new Error(
        `“${file.name}” is a legacy Word .doc file. Open it in Word or LibreOffice and save it as .docx, then convert it here.`,
      )
    }
    throw new Error(`“${file.name}” doesn’t look like a Word .docx document.`)
  }
  return buffer
}

function collectWarnings(messages: { type: string; message: string }[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of messages) {
    if (seen.has(m.message)) continue
    seen.add(m.message)
    out.push(m.message)
    if (out.length >= 5) break
  }
  return out
}

export async function docxToRawText(file: File): Promise<DocxOutput> {
  const buffer = await checkDocx(file)
  const mammoth = await loadMammoth()
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    return { value: result.value, warnings: collectWarnings(result.messages) }
  } catch (error) {
    throw describeFailure(error, file.name)
  }
}

export interface DocxHtmlOptions {
  /** Embed images as base64 data URIs. When false they become empty <img> tags. */
  embedImages: boolean
}

export async function docxToHtml(file: File, options: DocxHtmlOptions): Promise<DocxOutput> {
  const buffer = await checkDocx(file)
  const mammoth = await loadMammoth()
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
      ...(options.embedImages
        ? {}
        : { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) }),
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote:fresh",
        "r[style-name='Code Char'] => code",
        'strike => del',
      ],
    })
    return { value: result.value, warnings: collectWarnings(result.messages) }
  } catch (error) {
    throw describeFailure(error, file.name)
  }
}
