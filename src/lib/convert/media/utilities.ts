/** The audio utility pages and the subtitle burner: registry entries and explainer text. */
import type { Tool } from '@/lib/tools/types'

export type UtilityId = 'reverse' | 'speed' | 'volume' | 'normalize' | 'fade' | 'pitch' | 'ringtone' | 'subtitles'

export interface ExplainerSection {
  h2: string
  p: string[]
  table?: { head: string[]; rows: string[][] }
}

export interface Utility {
  id: UtilityId
  tool: Tool
  explainer: ExplainerSection[]
}

const UPDATED = '2026-11-07'
const PRIVACY = {
  q: 'Is my file uploaded?',
  a: 'No. FFmpeg, compiled to WebAssembly, runs in this browser tab. The page has no server that could receive the file.',
}
const FORMATS_FAQ = {
  q: 'Which formats can I use?',
  a: 'MP3, WAV, M4A, AAC, OGG, Opus, FLAC, AIFF, WMA and AMR, and the sound track of MP4, MOV, WebM and MKV videos. By default the result has the same format as the input.',
}

const audio = (
  id: UtilityId,
  slug: string,
  title: string,
  description: string,
  keywords: string[],
  icon: string,
  faqs: { q: string; a: string }[],
  related: string[],
  explainer: ExplainerSection[],
): Utility => ({
  id,
  tool: { slug, title, description, keywords, category: 'media', icon, accepts: ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'opus', 'aac'], faqs, related, updated: UPDATED },
  explainer,
})

export const UTILITIES: Utility[] = [
  audio(
    'reverse',
    'reverse-audio',
    'Reverse Audio',
    'Play a song, voice note or sound effect backwards. Reverse MP3, WAV, M4A and other audio in your browser and download the result. No upload.',
    ['play audio backwards', 'reverse mp3', 'reverse a song', 'backwards audio'],
    'Undo2',
    [
      { q: 'How is audio reversed?', a: 'The samples are read from the last to the first and written in that order. Nothing else changes: the length, the pitch and the loudness stay the same.' },
      FORMATS_FAQ,
      PRIVACY,
    ],
    ['audio-speed-changer', 'audio-pitch-changer', 'trim-audio', 'audio-converter'],
    [
      { h2: 'How it works', p: ['FFmpeg decodes the whole file, applies the areverse filter, which writes the samples in reverse order, and encodes the result in the format you choose.', 'Reversing needs the whole track in memory: about 10 MB per minute of stereo audio, so even long recordings work.'] },
      { h2: 'Uses', p: ['Finding hidden messages in songs, sound design (reversed cymbals and reverb swells), language games and checking a recording for clicks.'] },
    ],
  ),
  audio(
    'speed',
    'audio-speed-changer',
    'Audio Speed Changer',
    'Speed up or slow down audio from 0.5× to 3×, with the pitch kept or shifted. Works with MP3, WAV, M4A and more, in your browser.',
    ['speed up audio', 'slow down audio', 'change audio tempo', 'audio speed', 'podcast speed'],
    'FastForward',
    [
      { q: 'Does the voice sound higher when I speed it up?', a: 'Not with Keep the pitch on: the time-stretch filter changes the tempo and leaves the pitch. Turn it off to change both, like a tape played faster.' },
      { q: 'What speed should I use for a podcast or lecture?', a: '1.25× to 1.5× is easy to follow for most speech. Above 2× the words start to blur.' },
      FORMATS_FAQ,
      PRIVACY,
    ],
    ['audio-pitch-changer', 'video-speed-changer', 'reverse-audio', 'trim-audio'],
    [
      {
        h2: 'Two ways to change speed',
        p: ['With the pitch kept, FFmpeg\'s atempo filter cuts the sound into short overlapping pieces and moves them closer together or further apart, so the tempo changes and the pitch does not. Each atempo step works from 0.5× to 2×; bigger changes chain two steps.', 'Without it, the samples are simply played at a different rate (asetrate), which changes tempo and pitch together.'],
        table: {
          head: ['Speed', 'New length of 10 min', 'Pitch change without Keep the pitch'],
          rows: [
            ['0.75×', '13 min 20 s', '−5 semitones'],
            ['1.25×', '8 min', '+3.9 semitones'],
            ['1.5×', '6 min 40 s', '+7 semitones'],
            ['2×', '5 min', '+12 semitones (one octave)'],
          ],
        },
      },
    ],
  ),
  audio(
    'volume',
    'volume-booster',
    'Volume Booster',
    'Make quiet audio louder or loud audio quieter by up to 24 dB, with a peak limiter that stops clipping. Runs in your browser, no upload.',
    ['increase volume of audio', 'make mp3 louder', 'audio volume booster', 'amplify audio'],
    'Volume2',
    [
      { q: 'How much louder is +6 dB?', a: '+6 dB doubles the amplitude of the signal. Most people hear about +10 dB as twice as loud.' },
      { q: 'Why use the limiter?', a: 'A boost can push peaks past the maximum level, which clips them and sounds harsh. The limiter turns down only those peaks so they stay just below full scale.' },
      FORMATS_FAQ,
      PRIVACY,
    ],
    ['normalize-audio', 'fade-in-fade-out-audio', 'audio-converter', 'trim-audio'],
    [
      {
        h2: 'Decibels and amplitude',
        p: ['The gain in decibels sets a fixed multiplier for every sample: amplitude × 10^(dB/20).'],
        table: { head: ['Change', 'Amplitude'], rows: [['−6 dB', '0.50×'], ['+3 dB', '1.41×'], ['+6 dB', '2.00×'], ['+12 dB', '3.98×'], ['+20 dB', '10.0×']] },
      },
      { h2: 'Boost or normalize?', p: ['A boost adds the same gain to the whole file. To bring several files to the same loudness, use Normalize Audio, which measures the loudness first.'] },
    ],
  ),
  audio(
    'normalize',
    'normalize-audio',
    'Normalize Audio',
    'Make audio files equally loud: normalize to −14, −16 or −23 LUFS with the EBU R128 loudness filter. MP3, WAV, M4A and more, no upload.',
    ['loudness normalization', 'lufs normalize', 'normalize mp3', 'podcast loudness', 'ebu r128'],
    'AudioWaveform',
    [
      { q: 'Which target should I choose?', a: 'Music streaming services play at about −14 LUFS, podcasts aim for −16 LUFS (−19 for mono speech), and EU broadcast uses −23 LUFS.' },
      { q: 'Is this peak normalization?', a: 'No. Peak normalization only moves the loudest sample to the top. Loudness normalization measures how loud the audio sounds over time, which is what makes two files match.' },
      FORMATS_FAQ,
      PRIVACY,
    ],
    ['volume-booster', 'fade-in-fade-out-audio', 'audio-converter', 'audio-joiner'],
    [
      {
        h2: 'How loudness is measured',
        p: ['Loudness in LUFS (loudness units relative to full scale) follows ITU-R BS.1770: the signal is weighted toward the frequencies the ear hears best, quiet passages are left out, and the energy is averaged. FFmpeg\'s loudnorm filter measures this as it goes and adjusts the gain, with the true peak held below −1.5 dBTP.'],
        table: { head: ['Target', 'Used by'], rows: [['−14 LUFS', 'Music streaming'], ['−16 LUFS', 'Podcasts (stereo)'], ['−19 LUFS', 'Podcasts (mono speech)'], ['−23 LUFS', 'EU television (EBU R128)'], ['−24 LKFS', 'US television (ATSC A/85)']] },
      },
    ],
  ),
  audio(
    'fade',
    'fade-in-fade-out-audio',
    'Fade In and Fade Out Audio',
    'Add a fade in at the start and a fade out at the end of an audio file, from half a second to a minute. MP3, WAV, M4A and more, in your browser.',
    ['fade audio', 'add fade in', 'add fade out', 'fade out mp3', 'audio fade'],
    'Activity',
    [
      { q: 'How long should a fade be?', a: 'Half a second to 1 second removes clicks at a cut. 3 to 5 seconds suits the end of a song. 10 seconds or more gives a slow radio-style fade.' },
      FORMATS_FAQ,
      PRIVACY,
    ],
    ['volume-booster', 'trim-audio', 'ringtone-maker', 'normalize-audio'],
    [{ h2: 'How it works', p: ['FFmpeg\'s afade filter multiplies the samples by a gain that rises from 0 to 1 over the fade in, and falls from 1 to 0 over the fade out, which ends exactly at the end of the file. The curve is a triangle (linear gain), which sounds smooth for music and speech.'] }],
  ),
  audio(
    'pitch',
    'audio-pitch-changer',
    'Audio Pitch Changer',
    'Shift the pitch of a song or voice up or down by up to 12 semitones while the tempo stays the same. Change the key of music in your browser.',
    ['change pitch of audio', 'pitch shifter', 'change key of song', 'transpose audio'],
    'Music2',
    [
      { q: 'Does the song get faster or slower?', a: 'No. The page raises the sample rate to shift the pitch, then time-stretches the result back to the original length.' },
      { q: 'How many semitones is a key change?', a: 'Each semitone is one step on a piano. Two semitones move a song from C to D; twelve make one octave.' },
      FORMATS_FAQ,
      PRIVACY,
    ],
    ['audio-speed-changer', 'reverse-audio', 'audio-converter', 'trim-audio'],
    [
      {
        h2: 'How the pitch shift works',
        p: ['A shift of n semitones multiplies every frequency by 2^(n/12). FFmpeg plays the samples at that higher or lower rate (asetrate), resamples to the original rate, and then stretches the time back with atempo, so the length does not change.'],
        table: { head: ['Shift', 'Frequency factor'], rows: [['−12', '0.5'], ['−5', '0.749'], ['+1', '1.059'], ['+2', '1.122'], ['+7', '1.498'], ['+12', '2.0']] },
      },
    ],
  ),
  audio(
    'ringtone',
    'ringtone-maker',
    'Ringtone Maker',
    'Cut a ringtone from any song: choose the start and length, add fades, and save as M4R for iPhone or MP3 for Android. Runs in your browser.',
    ['make ringtone', 'm4r maker', 'iphone ringtone maker', 'mp3 to m4r', 'android ringtone'],
    'BellRing',
    [
      { q: 'How do I put the ringtone on an iPhone?', a: 'Copy the M4R file to the phone with your computer\'s device manager or music app, then choose it in Settings, Sounds. An iPhone ringtone can be up to 40 seconds long.' },
      { q: 'How do I use it on Android?', a: 'Save the MP3 to the Ringtones folder of the phone, or open it in the Files app and set it as the ringtone.' },
      PRIVACY,
    ],
    ['trim-audio', 'fade-in-fade-out-audio', 'mp3-to-m4a', 'audio-converter'],
    [{ h2: 'What an M4R file is', p: ['An M4R file is AAC audio in an MP4 container with the .m4r extension, the format iPhones use for ringtones and alert tones. The page cuts the part you choose, adds the fades and encodes it at 192 kbps.'] }],
  ),
  {
    id: 'subtitles',
    tool: {
      slug: 'burn-subtitles-into-video',
      title: 'Burn Subtitles Into Video',
      h1: 'Burn subtitles into a video',
      description: 'Add an SRT, VTT or ASS subtitle file to a video as permanent text, with the size, position and background you choose. Runs in your browser.',
      keywords: ['add subtitles to video', 'hardcode subtitles', 'srt to video', 'embed subtitles permanently', 'open captions'],
      category: 'media',
      icon: 'Captions',
      accepts: ['mp4', 'mov', 'mkv', 'webm', 'srt', 'vtt', 'ass'],
      faqs: [
        { q: 'What is the difference between burned-in and soft subtitles?', a: 'Burned-in (open) subtitles are part of the picture, so they show on every player and social site but cannot be turned off. Soft subtitles are a separate track that viewers switch on.' },
        { q: 'Where do I get an SRT file?', a: 'Write one in a text editor, export it from a video editor, or make one from the speech with the subtitle generator on this site.' },
        { q: 'Why does it take longer than other conversions?', a: 'Every frame gets new pixels, so the whole video is re-encoded to H.264. Shorter clips and smaller videos finish faster.' },
        PRIVACY,
      ],
      related: ['subtitle-generator', 'trim-video', 'compress-video', 'video-converter'],
      updated: UPDATED,
    },
    explainer: [
      { h2: 'How it works', p: ['FFmpeg reads the subtitle file and draws each line onto the frames at its time code with its subtitle renderer, using a font that ships with this page. The frames are then encoded as H.264 MP4 with AAC sound.'] },
      {
        h2: 'Subtitle formats',
        p: ['SRT is the simplest: numbered cues with start and end times. VTT is the web format with similar cues. ASS carries its own fonts, colours and positions; the style settings here apply to SRT and VTT.'],
        table: { head: ['Format', 'Timing line'], rows: [['SRT', '00:00:01,000 --> 00:00:04,000'], ['VTT', '00:00:01.000 --> 00:00:04.000'], ['ASS', 'Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Text']] },
      },
    ],
  },
]

export const UTILITY_BY_SLUG: Map<string, Utility> = new Map(UTILITIES.map((u) => [u.tool.slug, u]))
export const utilityTools: Tool[] = UTILITIES.map((u) => u.tool)
