/** Symbologies this tool exposes, in the order they appear in the picker. */
export type Symbology =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'EAN8'
  | 'UPC'
  | 'ITF14'
  | 'MSI'
  | 'pharmacode'
  | 'codabar'

export interface SymbologyInfo {
  id: Symbology
  /** Human label shown in the picker. */
  label: string
  /** One-line description used under the picker. */
  blurb: string
  /** What characters the symbology accepts. */
  charset: string
  /** Typical length rule, for the reference table. */
  length: string
  /** A valid sample value. */
  sample: string
  /** Where you actually meet this barcode. */
  usedFor: string
}

export const SYMBOLOGIES: SymbologyInfo[] = [
  {
    id: 'CODE128',
    label: 'Code 128',
    blurb:
      'The general-purpose workhorse: every ASCII character, automatically switched between three sub-sets for the shortest possible symbol.',
    charset: 'All 128 ASCII characters',
    length: 'Any length',
    sample: 'ONTHISDEVICE-128',
    usedFor: 'Shipping labels, logistics, GS1-128, internal asset tags',
  },
  {
    id: 'CODE39',
    label: 'Code 39',
    blurb:
      'The older alphanumeric standard. Only uppercase letters, digits and seven symbols, and roughly 30% wider than Code 128 for the same text.',
    charset: 'A–Z, 0–9, space and - . $ / + %',
    length: 'Any length',
    sample: 'CODE-39',
    usedFor: 'Defence, automotive, badge and inventory systems',
  },
  {
    id: 'EAN13',
    label: 'EAN-13',
    blurb:
      'The retail barcode on almost every product sold outside North America. Twelve digits plus a calculated check digit.',
    charset: 'Digits only',
    length: '12 digits (check digit added) or 13 digits',
    sample: '5901234123457',
    usedFor: 'Retail products worldwide, books via ISBN-13',
  },
  {
    id: 'EAN8',
    label: 'EAN-8',
    blurb: 'The short EAN used when a package is too small for a full EAN-13.',
    charset: 'Digits only',
    length: '7 digits (check digit added) or 8 digits',
    sample: '96385074',
    usedFor: 'Small retail packaging: sweets, cosmetics, cigarettes',
  },
  {
    id: 'UPC',
    label: 'UPC-A',
    blurb: 'The North American retail barcode. Eleven digits plus a check digit.',
    charset: 'Digits only',
    length: '11 digits (check digit added) or 12 digits',
    sample: '036000291452',
    usedFor: 'Retail products in the United States and Canada',
  },
  {
    id: 'ITF14',
    label: 'ITF-14',
    blurb:
      'The shipping-container barcode, printed with a heavy bearer bar so a damaged edge cannot be misread as a short scan.',
    charset: 'Digits only',
    length: '13 digits (check digit added) or 14 digits',
    sample: '15400141288763',
    usedFor: 'Outer cases, pallets and cartons',
  },
  {
    id: 'MSI',
    label: 'MSI Plessey',
    blurb: 'A numeric-only symbology still used for shelf-edge and warehouse labels.',
    charset: 'Digits only',
    length: 'Any length',
    sample: '1234567',
    usedFor: 'Supermarket shelf labels, inventory racking',
  },
  {
    id: 'pharmacode',
    label: 'Pharmacode',
    blurb:
      'A one-track pharmaceutical code that survives poor print quality. It encodes a single number, not text.',
    charset: 'A whole number',
    length: '3 to 131070',
    sample: '1234',
    usedFor: 'Medicine cartons and package inserts',
  },
  {
    id: 'codabar',
    label: 'Codabar',
    blurb:
      'A self-checking numeric code with A–D start and stop characters, still standard in blood banks and libraries.',
    charset: 'Digits and - $ : / . +, optional A–D start/stop',
    length: 'Any length',
    sample: 'A123456789B',
    usedFor: 'Blood banks, libraries, photo labs, courier waybills',
  },
]

export const SYMBOLOGY_BY_ID: Record<Symbology, SymbologyInfo> = Object.fromEntries(
  SYMBOLOGIES.map((s) => [s.id, s]),
) as Record<Symbology, SymbologyInfo>

export interface ValidationResult {
  ok: boolean
  /** Human-readable problem, when `ok` is false. */
  message?: string
  /** The value actually handed to the encoder (may gain a check digit). */
  value: string
  /** Explanation of any automatic fix that was applied. */
  note?: string
}

/** Modulo-10 check digit used by EAN-8, EAN-13, UPC-A and ITF-14. */
export function gtinCheckDigit(digits: string): number {
  let sum = 0
  // The rightmost digit of the payload always carries weight 3.
  for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(digits[i]) * weight
  }
  return (10 - (sum % 10)) % 10
}

function validateGtin(
  raw: string,
  payloadLength: number,
  name: string,
): ValidationResult {
  const digits = raw.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(digits)) {
    return { ok: false, value: raw, message: `${name} is digits only. Remove any letters or symbols.` }
  }
  if (digits.length === payloadLength) {
    const check = gtinCheckDigit(digits)
    return {
      ok: true,
      value: digits + check,
      note: `Check digit ${check} was calculated and appended.`,
    }
  }
  if (digits.length === payloadLength + 1) {
    const expected = gtinCheckDigit(digits.slice(0, payloadLength))
    if (Number(digits[payloadLength]) !== expected) {
      return {
        ok: false,
        value: digits,
        message: `The check digit is wrong. For ${digits.slice(
          0,
          payloadLength,
        )} it should be ${expected}, not ${digits[payloadLength]}.`,
      }
    }
    return { ok: true, value: digits }
  }
  return {
    ok: false,
    value: digits,
    message: `${name} needs ${payloadLength} digits (the check digit is added for you) or ${
      payloadLength + 1
    } including it. You entered ${digits.length}.`,
  }
}

/**
 * Validate a value for a symbology, correcting what can be corrected
 * (check digits, Code 39 casing) and explaining what cannot.
 */
export function validateBarcode(symbology: Symbology, raw: string): ValidationResult {
  const value = raw.trim()
  if (value.length === 0) {
    return { ok: false, value, message: 'Enter the value you want to encode.' }
  }

  switch (symbology) {
    case 'CODE128': {
      const bad = [...value].find((char) => char.charCodeAt(0) > 127)
      if (bad !== undefined) {
        return {
          ok: false,
          value,
          message: `Code 128 only encodes ASCII. “${bad}” is outside that range. Use Code 128 with plain ASCII, or a QR code for full Unicode.`,
        }
      }
      return { ok: true, value }
    }

    case 'CODE39': {
      const upper = value.toUpperCase()
      const invalid = [...upper].find((char) => !/[0-9A-Z\-. $/+%]/.test(char))
      if (invalid !== undefined) {
        return {
          ok: false,
          value: upper,
          message: `Code 39 cannot encode “${invalid}”. Allowed characters are A–Z, 0–9, space, hyphen, period, dollar, slash, plus and percent.`,
        }
      }
      return {
        ok: true,
        value: upper,
        note: upper !== value ? 'Code 39 has no lowercase letters, so the text was capitalised.' : undefined,
      }
    }

    case 'EAN13':
      return validateGtin(value, 12, 'EAN-13')
    case 'EAN8':
      return validateGtin(value, 7, 'EAN-8')
    case 'UPC':
      return validateGtin(value, 11, 'UPC-A')
    case 'ITF14':
      return validateGtin(value, 13, 'ITF-14')

    case 'MSI': {
      if (!/^\d+$/.test(value)) {
        return { ok: false, value, message: 'MSI Plessey encodes digits only.' }
      }
      return { ok: true, value }
    }

    case 'pharmacode': {
      if (!/^\d+$/.test(value)) {
        return { ok: false, value, message: 'Pharmacode encodes a single whole number.' }
      }
      const n = Number(value)
      if (n < 3 || n > 131070) {
        return {
          ok: false,
          value,
          message: `Pharmacode covers 3 to 131070. ${n} is outside that range.`,
        }
      }
      return { ok: true, value: String(n) }
    }

    case 'codabar': {
      const upper = value.toUpperCase()
      const body = /^[A-D]/.test(upper) && /[A-D]$/.test(upper) ? upper.slice(1, -1) : upper
      const invalid = [...body].find((char) => !/[0-9\-$:/.+]/.test(char))
      if (invalid !== undefined) {
        return {
          ok: false,
          value: upper,
          message: `Codabar cannot encode “${invalid}”. The body allows digits and - $ : / . + only, with an optional A–D start and stop character.`,
        }
      }
      if (body.length === 0) {
        return { ok: false, value: upper, message: 'Codabar needs at least one digit between the start and stop characters.' }
      }
      if (body === upper) {
        return {
          ok: true,
          value: `A${upper}A`,
          note: 'Codabar requires start and stop characters, so A…A was added automatically.',
        }
      }
      return { ok: true, value: upper }
    }

    default:
      return { ok: true, value }
  }
}
