/**
 * OCR languages: Tesseract LSTM data (best models as integers, Apache-2.0) served from
 * /ocr/lang/; scripts/vendor-models.mjs lists the same codes.
 */
export interface OcrLanguage {
  code: string
  name: string
  /** Latin-script text can go into the hidden text layer of a PDF with a standard font. */
  latin: boolean
}

export const OCR_LANGUAGES: OcrLanguage[] = [
  { code: 'eng', name: 'English', latin: true },
  { code: 'spa', name: 'Spanish', latin: true },
  { code: 'fra', name: 'French', latin: true },
  { code: 'deu', name: 'German', latin: true },
  { code: 'ita', name: 'Italian', latin: true },
  { code: 'por', name: 'Portuguese', latin: true },
  { code: 'nld', name: 'Dutch', latin: true },
  { code: 'pol', name: 'Polish', latin: true },
  { code: 'tur', name: 'Turkish', latin: true },
  { code: 'vie', name: 'Vietnamese', latin: true },
  { code: 'ind', name: 'Indonesian', latin: true },
  { code: 'rus', name: 'Russian', latin: false },
  { code: 'ukr', name: 'Ukrainian', latin: false },
  { code: 'ara', name: 'Arabic', latin: false },
  { code: 'hin', name: 'Hindi', latin: false },
  { code: 'chi_sim', name: 'Chinese (simplified)', latin: false },
  { code: 'chi_tra', name: 'Chinese (traditional)', latin: false },
  { code: 'jpn', name: 'Japanese', latin: false },
  { code: 'kor', name: 'Korean', latin: false },
]

export const LANG_DIR = '/ocr/lang/4.0.0_best_int'

export function langFile(code: string): string {
  return `${LANG_DIR}/${code}.traineddata.gz`
}
