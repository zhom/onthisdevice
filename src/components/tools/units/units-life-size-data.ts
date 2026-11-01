/**
 * units-life batch — static size tables for the shoe, clothing and ring
 * converters.
 *
 * Everything here is a published chart, not a formula. Shoe and clothing sizing
 * has no international standard: two brands can be a full size apart at the
 * same label, which is why every one of these tables is anchored to a physical
 * measurement (foot length, body circumference, ring diameter) rather than to
 * another brand's label.
 */

export interface ShoeRow {
  /** Foot length in centimetres — also the Japanese size (Mondopoint is this in mm). */
  cm: number
  us: string
  uk: string
  eu: string
}

/** Men's / unisex adult shoe sizes. */
export const SHOE_MEN: ShoeRow[] = [
  { cm: 22.4, us: '4', uk: '3.5', eu: '36' },
  { cm: 22.9, us: '4.5', uk: '4', eu: '36.5' },
  { cm: 23.3, us: '5', uk: '4.5', eu: '37.5' },
  { cm: 23.7, us: '5.5', uk: '5', eu: '38' },
  { cm: 24.1, us: '6', uk: '5.5', eu: '38.5' },
  { cm: 24.6, us: '6.5', uk: '6', eu: '39' },
  { cm: 25.0, us: '7', uk: '6', eu: '40' },
  { cm: 25.4, us: '7.5', uk: '6.5', eu: '40.5' },
  { cm: 25.8, us: '8', uk: '7', eu: '41' },
  { cm: 26.2, us: '8.5', uk: '7.5', eu: '42' },
  { cm: 26.7, us: '9', uk: '8', eu: '42.5' },
  { cm: 27.1, us: '9.5', uk: '8.5', eu: '43' },
  { cm: 27.5, us: '10', uk: '9', eu: '44' },
  { cm: 27.9, us: '10.5', uk: '9.5', eu: '44.5' },
  { cm: 28.3, us: '11', uk: '10', eu: '45' },
  { cm: 28.8, us: '11.5', uk: '10.5', eu: '45.5' },
  { cm: 29.2, us: '12', uk: '11', eu: '46' },
  { cm: 29.6, us: '12.5', uk: '11.5', eu: '47' },
  { cm: 30.0, us: '13', uk: '12', eu: '47.5' },
  { cm: 30.5, us: '13.5', uk: '12.5', eu: '48' },
  { cm: 30.8, us: '14', uk: '13', eu: '48.5' },
  { cm: 31.6, us: '15', uk: '14', eu: '49.5' },
  { cm: 32.4, us: '16', uk: '15', eu: '50.5' },
]

/** Women's adult shoe sizes. */
export const SHOE_WOMEN: ShoeRow[] = [
  { cm: 20.8, us: '4', uk: '2', eu: '35' },
  { cm: 21.3, us: '4.5', uk: '2.5', eu: '35' },
  { cm: 21.6, us: '5', uk: '3', eu: '35.5' },
  { cm: 22.2, us: '5.5', uk: '3.5', eu: '36' },
  { cm: 22.5, us: '6', uk: '4', eu: '36.5' },
  { cm: 23.0, us: '6.5', uk: '4.5', eu: '37' },
  { cm: 23.5, us: '7', uk: '5', eu: '37.5' },
  { cm: 23.8, us: '7.5', uk: '5.5', eu: '38' },
  { cm: 24.1, us: '8', uk: '6', eu: '38.5' },
  { cm: 24.6, us: '8.5', uk: '6.5', eu: '39' },
  { cm: 25.1, us: '9', uk: '7', eu: '39.5' },
  { cm: 25.4, us: '9.5', uk: '7.5', eu: '40' },
  { cm: 25.9, us: '10', uk: '8', eu: '40.5' },
  { cm: 26.2, us: '10.5', uk: '8.5', eu: '41' },
  { cm: 26.7, us: '11', uk: '9', eu: '41.5' },
  { cm: 27.1, us: '11.5', uk: '9.5', eu: '42' },
  { cm: 27.6, us: '12', uk: '10', eu: '42.5' },
]

/** Children's shoe sizes, little kids through youth. */
export const SHOE_KIDS: ShoeRow[] = [
  { cm: 16.5, us: '10C', uk: '9.5', eu: '27' },
  { cm: 17.1, us: '10.5C', uk: '10', eu: '27.5' },
  { cm: 17.8, us: '11C', uk: '10.5', eu: '28' },
  { cm: 18.1, us: '11.5C', uk: '11', eu: '29' },
  { cm: 18.4, us: '12C', uk: '11.5', eu: '30' },
  { cm: 19.1, us: '12.5C', uk: '12', eu: '30.5' },
  { cm: 19.4, us: '13C', uk: '12.5', eu: '31' },
  { cm: 20.0, us: '13.5C', uk: '13', eu: '31.5' },
  { cm: 20.3, us: '1Y', uk: '13.5', eu: '32' },
  { cm: 20.6, us: '1.5Y', uk: '1', eu: '32.5' },
  { cm: 21.0, us: '2Y', uk: '1.5', eu: '33' },
  { cm: 21.6, us: '2.5Y', uk: '2', eu: '33.5' },
  { cm: 21.9, us: '3Y', uk: '2.5', eu: '34' },
  { cm: 22.2, us: '3.5Y', uk: '3', eu: '34.5' },
  { cm: 22.9, us: '4Y', uk: '3.5', eu: '35' },
  { cm: 23.2, us: '4.5Y', uk: '4', eu: '35.5' },
  { cm: 23.5, us: '5Y', uk: '4.5', eu: '36' },
  { cm: 24.1, us: '5.5Y', uk: '5', eu: '37' },
  { cm: 24.4, us: '6Y', uk: '5.5', eu: '38' },
  { cm: 24.8, us: '6.5Y', uk: '6', eu: '38.5' },
  { cm: 25.1, us: '7Y', uk: '6.5', eu: '39' },
]

export interface WidthRow {
  code: string
  meaning: string
  who: string
}

export const SHOE_WIDTHS: WidthRow[] = [
  { code: '2A / AA', meaning: 'Narrow', who: "Women's narrow; rarely stocked in men's" },
  { code: 'B', meaning: 'Standard (women) / narrow (men)', who: "The default width in women's shoes" },
  { code: 'D', meaning: 'Standard (men) / wide (women)', who: "The default width in men's shoes" },
  { code: '2E / EE', meaning: 'Wide', who: 'Common in walking and running brands' },
  { code: '4E / EEEE', meaning: 'Extra wide', who: 'Specialist and orthopaedic fits' },
  { code: '6E', meaning: 'Extra extra wide', who: 'Diabetic and medical footwear' },
]

/* ------------------------------------------------------------------ *
 * Clothing
 * ------------------------------------------------------------------ */

export interface WomensClothingRow {
  us: string
  uk: string
  de: string
  fr: string
  it: string
  jp: string
  letter: string
  /** Body measurements in centimetres. */
  bust: number
  waist: number
  hip: number
}

export const CLOTHING_WOMEN: WomensClothingRow[] = [
  { us: '0', uk: '4', de: '30', fr: '32', it: '36', jp: '5', letter: 'XXS', bust: 79, waist: 61, hip: 87 },
  { us: '2', uk: '6', de: '32', fr: '34', it: '38', jp: '7', letter: 'XS', bust: 83, waist: 65, hip: 91 },
  { us: '4', uk: '8', de: '34', fr: '36', it: '40', jp: '9', letter: 'S', bust: 87, waist: 69, hip: 95 },
  { us: '6', uk: '10', de: '36', fr: '38', it: '42', jp: '11', letter: 'S', bust: 91, waist: 73, hip: 99 },
  { us: '8', uk: '12', de: '38', fr: '40', it: '44', jp: '13', letter: 'M', bust: 95, waist: 77, hip: 103 },
  { us: '10', uk: '14', de: '40', fr: '42', it: '46', jp: '15', letter: 'M', bust: 99, waist: 81, hip: 107 },
  { us: '12', uk: '16', de: '42', fr: '44', it: '48', jp: '17', letter: 'L', bust: 103, waist: 85, hip: 111 },
  { us: '14', uk: '18', de: '44', fr: '46', it: '50', jp: '19', letter: 'L', bust: 108, waist: 90, hip: 116 },
  { us: '16', uk: '20', de: '46', fr: '48', it: '52', jp: '21', letter: 'XL', bust: 113, waist: 95, hip: 121 },
  { us: '18', uk: '22', de: '48', fr: '50', it: '54', jp: '23', letter: 'XL', bust: 118, waist: 100, hip: 126 },
  { us: '20', uk: '24', de: '50', fr: '52', it: '56', jp: '25', letter: 'XXL', bust: 123, waist: 105, hip: 131 },
  { us: '22', uk: '26', de: '52', fr: '54', it: '58', jp: '27', letter: 'XXL', bust: 128, waist: 110, hip: 136 },
]

export interface MensClothingRow {
  letter: string
  usUk: string
  eu: string
  /** Chest in centimetres. */
  chest: number
  waist: number
  neck: number
}

export const CLOTHING_MEN: MensClothingRow[] = [
  { letter: 'XS', usUk: '34', eu: '44', chest: 87, waist: 74, neck: 36 },
  { letter: 'S', usUk: '36', eu: '46', chest: 92, waist: 79, neck: 38 },
  { letter: 'M', usUk: '38–40', eu: '48–50', chest: 99, waist: 86, neck: 40 },
  { letter: 'L', usUk: '42', eu: '52', chest: 107, waist: 94, neck: 42 },
  { letter: 'XL', usUk: '44', eu: '54', chest: 114, waist: 102, neck: 44 },
  { letter: 'XXL', usUk: '46–48', eu: '56–58', chest: 122, waist: 110, neck: 46 },
  { letter: '3XL', usUk: '50', eu: '60', chest: 130, waist: 118, neck: 48 },
]

export interface JeansRow {
  waistIn: number
  waistCm: number
  euMen: string
  usWomen: string
  ukWomen: string
}

export const JEANS: JeansRow[] = [
  { waistIn: 26, waistCm: 66, euMen: '36', usWomen: '2', ukWomen: '6' },
  { waistIn: 27, waistCm: 69, euMen: '38', usWomen: '4', ukWomen: '8' },
  { waistIn: 28, waistCm: 71, euMen: '38', usWomen: '6', ukWomen: '10' },
  { waistIn: 29, waistCm: 74, euMen: '40', usWomen: '8', ukWomen: '12' },
  { waistIn: 30, waistCm: 76, euMen: '40', usWomen: '10', ukWomen: '14' },
  { waistIn: 31, waistCm: 79, euMen: '42', usWomen: '12', ukWomen: '16' },
  { waistIn: 32, waistCm: 81, euMen: '42', usWomen: '14', ukWomen: '18' },
  { waistIn: 33, waistCm: 84, euMen: '44', usWomen: '16', ukWomen: '20' },
  { waistIn: 34, waistCm: 86, euMen: '46', usWomen: '18', ukWomen: '22' },
  { waistIn: 36, waistCm: 91, euMen: '48', usWomen: '20', ukWomen: '24' },
  { waistIn: 38, waistCm: 97, euMen: '50', usWomen: '22', ukWomen: '26' },
  { waistIn: 40, waistCm: 102, euMen: '52', usWomen: '24', ukWomen: '28' },
  { waistIn: 42, waistCm: 107, euMen: '54', usWomen: '26', ukWomen: '30' },
]

/* ------------------------------------------------------------------ *
 * Rings
 * ------------------------------------------------------------------ */

export interface RingRow {
  us: string
  uk: string
  /** ISO 8653 size — the inside circumference in millimetres, rounded. */
  eu: string
  jp: string
  diameterMm: number
  circumferenceMm: number
}

export const RING_SIZES: RingRow[] = [
  { us: '3', uk: 'F', eu: '44', jp: '4', diameterMm: 14.1, circumferenceMm: 44.2 },
  { us: '3.5', uk: 'G', eu: '45.5', jp: '5', diameterMm: 14.5, circumferenceMm: 45.5 },
  { us: '4', uk: 'H', eu: '46.8', jp: '7', diameterMm: 14.9, circumferenceMm: 46.8 },
  { us: '4.5', uk: 'I', eu: '48', jp: '8', diameterMm: 15.3, circumferenceMm: 48.0 },
  { us: '5', uk: 'J 1/2', eu: '49.3', jp: '9', diameterMm: 15.7, circumferenceMm: 49.3 },
  { us: '5.5', uk: 'K 1/2', eu: '50.6', jp: '10', diameterMm: 16.1, circumferenceMm: 50.6 },
  { us: '6', uk: 'L 1/2', eu: '51.9', jp: '12', diameterMm: 16.5, circumferenceMm: 51.9 },
  { us: '6.5', uk: 'M 1/2', eu: '53.1', jp: '13', diameterMm: 16.9, circumferenceMm: 53.1 },
  { us: '7', uk: 'N 1/2', eu: '54.4', jp: '14', diameterMm: 17.3, circumferenceMm: 54.4 },
  { us: '7.5', uk: 'O 1/2', eu: '55.7', jp: '15', diameterMm: 17.7, circumferenceMm: 55.7 },
  { us: '8', uk: 'P 1/2', eu: '57', jp: '16', diameterMm: 18.1, circumferenceMm: 57.0 },
  { us: '8.5', uk: 'Q 1/2', eu: '58.3', jp: '17', diameterMm: 18.5, circumferenceMm: 58.3 },
  { us: '9', uk: 'R 1/2', eu: '59.5', jp: '18', diameterMm: 18.9, circumferenceMm: 59.5 },
  { us: '9.5', uk: 'S 1/2', eu: '60.8', jp: '19', diameterMm: 19.4, circumferenceMm: 60.8 },
  { us: '10', uk: 'T 1/2', eu: '62.1', jp: '20', diameterMm: 19.8, circumferenceMm: 62.1 },
  { us: '10.5', uk: 'U 1/2', eu: '63.4', jp: '22', diameterMm: 20.2, circumferenceMm: 63.4 },
  { us: '11', uk: 'V 1/2', eu: '64.6', jp: '23', diameterMm: 20.6, circumferenceMm: 64.6 },
  { us: '11.5', uk: 'W 1/2', eu: '65.9', jp: '24', diameterMm: 21.0, circumferenceMm: 65.9 },
  { us: '12', uk: 'Y', eu: '67.2', jp: '25', diameterMm: 21.4, circumferenceMm: 67.2 },
  { us: '12.5', uk: 'Z', eu: '68.5', jp: '26', diameterMm: 21.8, circumferenceMm: 68.5 },
  { us: '13', uk: 'Z+1', eu: '69.7', jp: '27', diameterMm: 22.2, circumferenceMm: 69.7 },
]

/** Width of a standard ID-1 payment card, used to calibrate the on-screen sizer. */
export const CREDIT_CARD_WIDTH_MM = 85.6
