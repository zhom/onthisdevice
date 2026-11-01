/** One transcribed word. Times are seconds from the start of the recording. */
export interface Word {
  /** As the model wrote it, usually with a leading space. */
  text: string
  start: number
  end: number
}
