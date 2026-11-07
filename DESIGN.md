---
name: onthisdevice
description: Tools that run on your own device. Black ink, white paper, motion made of pixels.
colors:
  paper: "#ffffff"
  ink: "#000000"
  grey: "#6b6b6b"
  fill: "#f3f3f3"
  hairline: "#949494"
  paper-dark: "#000000"
  ink-dark: "#ffffff"
  grey-dark: "#a3a3a3"
  fill-dark: "#161616"
  hairline-dark: "#616161"
typography:
  family: "Archivo variable (self-hosted, OFL), normal width; ui-monospace for code and numbers in code"
  display: "760, clamp(2.5rem, 4.6vw + 1.6rem, 5.25rem), line-height 1"
  title: "720, clamp(2rem, 2.2vw + 1.55rem, 3.25rem), line-height 1.05"
  h2: "700, 1.5rem to 2rem"
  h3: "650, 1.0625rem"
  body: "400, 1rem, line-height 1.6"
  small: "0.875rem, grey"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
---

## Rules

- Strict black and white. Each theme has five values: paper, ink, one grey for secondary text,
  one faint fill, one hairline that only form fields use. Nothing else in the chrome.
- Status (error, success, warning) is ink with an icon and words. `destructive`, `success` and
  `warning` all resolve to ink, so a status needs its icon and its words.
- `chart-1` to `chart-5` are a grey ramp from ink toward paper. Use them for data series only.
- No borders on containers. A group is a faint fill (`bg-card` or `bg-muted`) or plain space.
  `border-border` resolves to the fill value, so a border on a filled box disappears.
- No dividers or ruled lines between sections. Space separates sections.
- No tags, pills, badges, italics, eyebrow labels, section numbers, breadcrumb trails, gradient
  text, glass, glow, emoji or decorative diagrams. Tracking is never below 0.
- Copy is plain, short and literal.

## Tokens

`src/styles/global.css` defines the five values per theme and maps the shadcn names onto them:
`background` paper, `foreground` and `primary` ink, `card`, `muted`, `secondary`, `accent` and
`border` fill, `muted-foreground` grey, `input` hairline, `ring` ink, `popover` paper (fill in
dark). Overlays (menus, dialogs, popovers) use `shadow-pop`, the only shadow.

## Type

One family, Archivo, at normal width. Classes `t-display`, `t-title`, `t-h2`, `t-h3`, `t-lead`,
`t-small`. Numbers use `num` (tabular). Fields are 16 px on phones.

## Components

- Buttons: primary is an ink block with paper text; secondary and outline are fill blocks; ghost
  is text that gets the fill on hover. Height 40 px (36 px small). Press: scale 0.97.
- Fields: paper background, 1 px hairline, 8 px corners; focus is a 2 px ink ring.
- Tool panel: fill block, 12 px corners, no border.
- Lists of tools: rows with a line icon, a title and one line of grey text, in a borderless grid.
  Hover gives the row the fill.
- Category glyphs: a 9 x 9 grid of square pixels per category (`src/lib/glyphs.ts`). A scan moves
  left to right and the pixels change between the category's frames: input to output.
- Home hero: the heading names a task ("Remove backgrounds", then "free, on this device."), a
  plain lead, then the search field and a "Choose a file" button. The button opens the drop
  screen, which lists the tools for the file. Behind the hero, a reel of 1-bit pixel scenes
  (`src/components/site/reel/`) shows one tool that other sites charge for per scene, about 3 s
  each. On large screens it fills the right part of the hero from top to bottom; left of the
  scene the picture goes on in the fill tone under the text and dissolves into the page. On
  smaller screens it runs edge to edge under the controls. A new scene dissolves in pixel by
  pixel, the heading phrase wipes out and in, and the caption links to the tool. One bar per
  scene shows progress and jumps to it; a button pauses the reel.
- Home body: a list of tools that other sites charge for, with what each one gives here.

## Motion

- Easing `--ease-out` (cubic-bezier(0.22, 1, 0.36, 1)) for entries, `--ease-in-out` for moves.
  Entries 200 to 320 ms, exits 120 to 180 ms. Only transform, opacity and clip-path.
- Page navigation uses cross-document view transitions: the header stays, content slides 24 px and
  fades in the direction of travel, a tool row's icon and title morph into the tool page heading.
  Speculation rules prerender a page on hover.
- The theme switch reveals the new theme in a circle from the switch.
- Drop zone: ink floods in from the pointer on drag-over; on drop it closes to the centre.
  Progress is a row of pixels that fills; unknown progress is a scan that passes along the row.
- Everything pauses offscreen and in a hidden tab. Reduced motion gives still frames and plain
  fades.
