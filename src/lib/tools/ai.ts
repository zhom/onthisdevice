/**
 * Tools that run AI models on the device. Each family lives in ./ai-families; the pages come from
 * src/pages/[slug].astro through src/components/tools/ai/Page.astro.
 */
import type { Tool } from './types'
import { tools as cutout } from './ai-families/cutout'
import { tools as upscale } from './ai-families/upscale'
import { tools as inpaint } from './ai-families/inpaint'
import { tools as depth } from './ai-families/depth'
import { tools as transcribe } from './ai-families/transcribe'
import { tools as read } from './ai-families/read'
import { tools as voice } from './ai-families/voice'
import { tools as denoise } from './ai-families/denoise'

export const tools: Tool[] = [...cutout, ...upscale, ...inpaint, ...depth, ...transcribe, ...read, ...voice, ...denoise]
