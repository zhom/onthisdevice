/**
 * Round-3 conversion tools: unit pairs, image, audio and video format pairs, media
 * utilities and archives. Pages come from src/pages/[slug].astro through
 * src/components/tools/convert/Page.astro.
 */
import type { Tool } from './types'
import { unitTools } from '@/lib/convert/units/registry'
import { electricTools } from '@/lib/convert/units/electrical'
import { imageTools } from '@/lib/convert/image/registry'
import { mediaTools } from '@/lib/convert/media/registry'
import { utilityTools } from '@/lib/convert/media/utilities'

export const tools: Tool[] = [...unitTools, ...electricTools, ...imageTools, ...mediaTools, ...utilityTools]
