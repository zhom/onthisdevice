/**
 * Applies (and removes) the PDF standard security handler across a pdf-lib
 * object graph. Kept separate from `pdf-secure-crypto.ts` so the maths and the
 * document surgery can be reasoned about independently.
 */
import type * as PdfLib from 'pdf-lib'
import type { CipherMethod, EncryptionInfo, PdfPermissions } from './pdf-secure-crypto'
import {
  buildR6Material,
  decryptData,
  encryptData,
  objectKey,
  randomBytes,
  toHex,
} from './pdf-secure-crypto'

export type PdfLibModule = typeof PdfLib
type PDFObjectLike = PdfLib.PDFObject
type ProgressFn = (done: number, total: number) => void | Promise<void>

export function loadPdfLib(): Promise<PdfLibModule> {
  return import('pdf-lib')
}

function refKey(ref: PdfLib.PDFRef): string {
  return `${ref.objectNumber}_${ref.generationNumber}`
}

/** Copy an object's serialized bytes out of pdf-lib (used for opaque objects). */
function objectBytes(obj: PDFObjectLike): Uint8Array {
  const buf = new Uint8Array(obj.sizeInBytes())
  obj.copyBytesInto(buf, 0)
  return buf
}

/* ------------------------------------------------------------------ *
 * Walking strings
 * ------------------------------------------------------------------ */

type StringTransform = (bytes: Uint8Array) => Promise<Uint8Array>

async function mapStrings(
  lib: PdfLibModule,
  node: PDFObjectLike,
  transform: StringTransform,
  depth = 0,
): Promise<void> {
  if (depth > 64) return
  const { PDFArray, PDFDict, PDFHexString, PDFStream, PDFString } = lib

  if (node instanceof PDFDict) {
    for (const [key, value] of node.entries()) {
      if (value instanceof PDFString || value instanceof PDFHexString) {
        node.set(key, PDFHexString.of(toHex(await transform(value.asBytes()))))
      } else {
        await mapStrings(lib, value, transform, depth + 1)
      }
    }
    return
  }

  if (node instanceof PDFArray) {
    for (let i = 0; i < node.size(); i++) {
      const value = node.get(i)
      if (value instanceof PDFString || value instanceof PDFHexString) {
        node.set(i, PDFHexString.of(toHex(await transform(value.asBytes()))))
      } else {
        await mapStrings(lib, value, transform, depth + 1)
      }
    }
    return
  }

  if (node instanceof PDFStream) {
    await mapStrings(lib, node.dict, transform, depth + 1)
  }
}

/* ------------------------------------------------------------------ *
 * Encrypting
 * ------------------------------------------------------------------ */

export interface EncryptRequest {
  userPassword: string
  ownerPassword: string
  permissions: PdfPermissions
  onProgress?: ProgressFn
}

export interface EncryptReport {
  objects: number
  streams: number
  strings: number
  /** Objects pdf-lib could not parse and therefore could not encrypt. */
  opaque: number
}

/**
 * Encrypt every string and stream in `context` with AES-256 (V=5, R=6) and
 * install the /Encrypt dictionary. The context is mutated in place; serialize
 * it afterwards with `PDFWriter`, never with `PDFDocument.save()` — save()
 * would add new, unencrypted objects.
 */
export async function encryptContext(
  lib: PdfLibModule,
  context: PdfLib.PDFContext,
  request: EncryptRequest,
): Promise<EncryptReport> {
  const {
    PDFArray,
    PDFBool,
    PDFDict,
    PDFHexString,
    PDFInvalidObject,
    PDFName,
    PDFNumber,
    PDFRawStream,
    PDFStream,
  } = lib

  const material = await buildR6Material(
    request.userPassword,
    request.ownerPassword,
    request.permissions,
    true,
  )

  const objects = context.enumerateIndirectObjects()
  const report: EncryptReport = { objects: objects.length, streams: 0, strings: 0, opaque: 0 }

  const transform: StringTransform = async (bytes) => {
    report.strings += 1
    return encryptData(material.fileKey, bytes, 'aesv3')
  }

  for (let i = 0; i < objects.length; i++) {
    const [ref, obj] = objects[i]

    if (obj instanceof PDFInvalidObject) {
      report.opaque += 1
      continue
    }

    if (obj instanceof PDFStream) {
      await mapStrings(lib, obj.dict, transform)
      const contents = obj.getContents()
      const encrypted = await encryptData(material.fileKey, contents, 'aesv3')
      obj.dict.set(PDFName.of('Length'), PDFNumber.of(encrypted.length))
      context.assign(ref, PDFRawStream.of(obj.dict, encrypted))
      report.streams += 1
    } else {
      await mapStrings(lib, obj, transform)
    }

    if (request.onProgress && (i % 40 === 0 || i === objects.length - 1)) {
      await request.onProgress(i + 1, objects.length)
    }
  }

  // The /Encrypt dictionary is never itself encrypted.
  const cryptFilter = PDFDict.withContext(context)
  cryptFilter.set(PDFName.of('CFM'), PDFName.of('AESV3'))
  cryptFilter.set(PDFName.of('AuthEvent'), PDFName.of('DocOpen'))
  cryptFilter.set(PDFName.of('Length'), PDFNumber.of(32))

  const cf = PDFDict.withContext(context)
  cf.set(PDFName.of('StdCF'), cryptFilter)

  const encryptDict = PDFDict.withContext(context)
  encryptDict.set(PDFName.of('Filter'), PDFName.of('Standard'))
  encryptDict.set(PDFName.of('V'), PDFNumber.of(5))
  encryptDict.set(PDFName.of('R'), PDFNumber.of(6))
  encryptDict.set(PDFName.of('Length'), PDFNumber.of(256))
  encryptDict.set(PDFName.of('CF'), cf)
  encryptDict.set(PDFName.of('StmF'), PDFName.of('StdCF'))
  encryptDict.set(PDFName.of('StrF'), PDFName.of('StdCF'))
  encryptDict.set(PDFName.of('U'), PDFHexString.of(toHex(material.U)))
  encryptDict.set(PDFName.of('UE'), PDFHexString.of(toHex(material.UE)))
  encryptDict.set(PDFName.of('O'), PDFHexString.of(toHex(material.O)))
  encryptDict.set(PDFName.of('OE'), PDFHexString.of(toHex(material.OE)))
  encryptDict.set(PDFName.of('Perms'), PDFHexString.of(toHex(material.Perms)))
  encryptDict.set(PDFName.of('P'), PDFNumber.of(material.P))
  encryptDict.set(PDFName.of('EncryptMetadata'), PDFBool.True)

  context.trailerInfo.Encrypt = context.register(encryptDict)

  // /ID is required alongside /Encrypt and must stay in the clear.
  const id = PDFArray.withContext(context)
  const idValue = PDFHexString.of(toHex(randomBytes(16)))
  id.push(idValue)
  id.push(idValue)
  context.trailerInfo.ID = id

  // Revision 6 arrived with PDF 2.0; older readers recognise it in a 1.7 file
  // through Adobe's extension level 8 marker, which is what Acrobat writes.
  const root = context.lookup(context.trailerInfo.Root)
  if (root instanceof PDFDict) {
    const adbe = PDFDict.withContext(context)
    adbe.set(PDFName.of('BaseVersion'), PDFName.of('1.7'))
    adbe.set(PDFName.of('ExtensionLevel'), PDFNumber.of(8))
    const extensions = PDFDict.withContext(context)
    extensions.set(PDFName.of('ADBE'), adbe)
    root.set(PDFName.of('Extensions'), extensions)
  }

  return report
}

/* ------------------------------------------------------------------ *
 * Reading an /Encrypt dictionary
 * ------------------------------------------------------------------ */

function numberAt(lib: PdfLibModule, dict: PdfLib.PDFDict, key: string, fallback: number): number {
  const value = dict.lookup(lib.PDFName.of(key))
  return value instanceof lib.PDFNumber ? value.asNumber() : fallback
}

function bytesAt(lib: PdfLibModule, dict: PdfLib.PDFDict, key: string): Uint8Array | null {
  const value = dict.lookup(lib.PDFName.of(key))
  if (value instanceof lib.PDFString || value instanceof lib.PDFHexString) return value.asBytes()
  return null
}

function cipherFor(lib: PdfLibModule, encrypt: PdfLib.PDFDict, filterName: string): CipherMethod {
  if (filterName === 'Identity') return 'none'
  const cf = encrypt.lookup(lib.PDFName.of('CF'))
  if (!(cf instanceof lib.PDFDict)) return 'rc4'
  const entry = cf.lookup(lib.PDFName.of(filterName))
  if (!(entry instanceof lib.PDFDict)) return 'rc4'
  const cfm = entry.lookup(lib.PDFName.of('CFM'))
  const name = cfm instanceof lib.PDFName ? cfm.asString().replace(/^\//, '') : 'V2'
  if (name === 'AESV3') return 'aesv3'
  if (name === 'AESV2') return 'aesv2'
  if (name === 'None') return 'none'
  return 'rc4'
}

export interface ParsedEncryption extends EncryptionInfo {
  streamMethod: CipherMethod
  stringMethod: CipherMethod
  encryptRef: PdfLib.PDFRef | null
}

/** Read the trailer's /Encrypt dictionary into a plain description. */
export function readEncryption(
  lib: PdfLibModule,
  context: PdfLib.PDFContext,
): ParsedEncryption | null {
  const raw = context.trailerInfo.Encrypt
  if (!raw) return null
  const encryptRef = raw instanceof lib.PDFRef ? raw : null
  const dict = context.lookup(raw)
  if (!(dict instanceof lib.PDFDict)) return null

  const filter = dict.lookup(lib.PDFName.of('Filter'))
  const filterName = filter instanceof lib.PDFName ? filter.asString().replace(/^\//, '') : ''
  if (filterName && filterName !== 'Standard') {
    throw new Error(
      `This PDF uses the “${filterName}” security handler, which is a vendor extension (usually enterprise DRM). Only the standard password handler can be removed locally.`,
    )
  }

  const version = numberAt(lib, dict, 'V', 0)
  const revision = numberAt(lib, dict, 'R', 2)
  const lengthBits = numberAt(lib, dict, 'Length', 40)

  let streamMethod: CipherMethod = 'rc4'
  let stringMethod: CipherMethod = 'rc4'
  let keyLength = Math.max(5, Math.floor(lengthBits / 8))

  if (version >= 4) {
    const stmF = dict.lookup(lib.PDFName.of('StmF'))
    const strF = dict.lookup(lib.PDFName.of('StrF'))
    const stmName = stmF instanceof lib.PDFName ? stmF.asString().replace(/^\//, '') : 'Identity'
    const strName = strF instanceof lib.PDFName ? strF.asString().replace(/^\//, '') : 'Identity'
    streamMethod = cipherFor(lib, dict, stmName)
    stringMethod = cipherFor(lib, dict, strName)
    const cf = dict.lookup(lib.PDFName.of('CF'))
    if (cf instanceof lib.PDFDict) {
      const entry = cf.lookup(lib.PDFName.of(stmName === 'Identity' ? strName : stmName))
      if (entry instanceof lib.PDFDict) {
        const cfLength = numberAt(lib, entry, 'Length', 0)
        if (cfLength > 0) keyLength = cfLength > 40 ? Math.floor(cfLength / 8) : cfLength
      }
    }
  }
  if (version === 5 || revision >= 5) {
    streamMethod = 'aesv3'
    stringMethod = 'aesv3'
    keyLength = 32
  }
  if (version <= 1) keyLength = 5

  const idArray = context.lookup(context.trailerInfo.ID)
  let idBytes: Uint8Array = new Uint8Array(0)
  if (idArray instanceof lib.PDFArray && idArray.size() > 0) {
    const first = idArray.lookup(0)
    if (first instanceof lib.PDFString || first instanceof lib.PDFHexString) idBytes = first.asBytes()
  }

  const O = bytesAt(lib, dict, 'O')
  const U = bytesAt(lib, dict, 'U')
  if (!O || !U) throw new Error('This PDF declares encryption but is missing its /O or /U entry.')

  const encryptMetadataValue = dict.lookup(lib.PDFName.of('EncryptMetadata'))
  const encryptMetadata =
    encryptMetadataValue instanceof lib.PDFBool ? encryptMetadataValue.asBoolean() : true

  return {
    version,
    revision,
    keyLength,
    method: streamMethod,
    streamMethod,
    stringMethod,
    O,
    U,
    OE: bytesAt(lib, dict, 'OE'),
    UE: bytesAt(lib, dict, 'UE'),
    P: numberAt(lib, dict, 'P', -1) | 0,
    encryptMetadata,
    idBytes,
    encryptRef,
  }
}

/* ------------------------------------------------------------------ *
 * Decrypting
 * ------------------------------------------------------------------ */

export interface DecryptReport {
  objects: number
  streams: number
  /** Object streams recovered after pdf-lib failed to inflate them. */
  recoveredObjectStreams: number
  /** Objects that stayed opaque — a sign the lossless path is unreliable. */
  opaque: number
}

/**
 * Remove encryption from a parsed context. Mutates in place and clears the
 * trailer's /Encrypt entry so the serialized output is a plain PDF.
 */
export async function decryptContext(
  lib: PdfLibModule,
  context: PdfLib.PDFContext,
  info: ParsedEncryption,
  fileKey: Uint8Array,
  onProgress?: ProgressFn,
): Promise<DecryptReport> {
  const {
    PDFInvalidObject,
    PDFName,
    PDFNumber,
    PDFObjectParser,
    PDFObjectStreamParser,
    PDFRawStream,
    PDFStream,
  } = lib

  const report: DecryptReport = {
    objects: 0,
    streams: 0,
    recoveredObjectStreams: 0,
    opaque: 0,
  }

  const skip = new Set<string>()
  if (info.encryptRef) skip.add(refKey(info.encryptRef))

  const preexisting = new Set(context.enumerateIndirectObjects().map(([ref]) => refKey(ref)))

  // Pass 1 — object streams. pdf-lib cannot inflate them while they are still
  // encrypted, so it parked them as opaque "invalid" objects. Decrypt, inflate
  // and expand them now; their contents are not separately encrypted.
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFInvalidObject)) continue
    try {
      const parsed = PDFObjectParser.forBytes(objectBytes(obj), context).parseObject()
      if (!(parsed instanceof PDFRawStream)) {
        report.opaque += 1
        continue
      }
      const type = parsed.dict.lookup(PDFName.of('Type'))
      if (!(type instanceof PDFName) || type.asString().replace(/^\//, '') !== 'ObjStm') {
        report.opaque += 1
        continue
      }
      const key = objectKey(fileKey, ref.objectNumber, ref.generationNumber, info.streamMethod)
      const clear = await decryptData(key, parsed.contents, info.streamMethod)
      parsed.dict.set(PDFName.of('Length'), PDFNumber.of(clear.length))
      const rebuilt = PDFRawStream.of(parsed.dict, clear)
      await PDFObjectStreamParser.forStream(rebuilt).parseIntoContext()
      context.delete(ref)
      preexisting.delete(refKey(ref))
      report.recoveredObjectStreams += 1
    } catch {
      report.opaque += 1
    }
  }

  // Pass 2 — everything that was already parsed.
  const objects = context.enumerateIndirectObjects()
  for (let i = 0; i < objects.length; i++) {
    const [ref, obj] = objects[i]
    const id = refKey(ref)
    if (skip.has(id) || !preexisting.has(id)) continue
    if (obj instanceof PDFInvalidObject) continue

    report.objects += 1
    const strKey = objectKey(fileKey, ref.objectNumber, ref.generationNumber, info.stringMethod)
    await mapStrings(lib, obj instanceof PDFStream ? obj.dict : obj, (bytes) =>
      decryptData(strKey, bytes, info.stringMethod),
    )

    if (obj instanceof PDFStream) {
      const type = obj.dict.lookup(PDFName.of('Type'))
      const typeName = type instanceof PDFName ? type.asString().replace(/^\//, '') : ''
      const isMetadata = typeName === 'Metadata'
      const method = isMetadata && !info.encryptMetadata ? 'none' : info.streamMethod
      const streamKey = objectKey(fileKey, ref.objectNumber, ref.generationNumber, method)
      const clear = await decryptData(streamKey, obj.getContents(), method)
      obj.dict.set(PDFName.of('Length'), PDFNumber.of(clear.length))
      context.assign(ref, PDFRawStream.of(obj.dict, clear))
      report.streams += 1
    }

    if (onProgress && (i % 40 === 0 || i === objects.length - 1)) {
      await onProgress(i + 1, objects.length)
    }
  }

  if (info.encryptRef) context.delete(info.encryptRef)
  context.trailerInfo.Encrypt = undefined

  return report
}

/** Serialize a context without going through `PDFDocument.save()`. */
export async function serializeContext(
  lib: PdfLibModule,
  context: PdfLib.PDFContext,
): Promise<Uint8Array> {
  return lib.PDFWriter.forContext(context, 80).serializeToBuffer()
}
