import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'resize-image',
    title: 'Resize Image',
    h1: 'Resize images online',
    description:
      'Resize an image (JPG, PNG, WebP or AVIF) by pixels, percentage or a social media preset. Lock the aspect ratio and keep the original format.',
    keywords: [
      'image resizer',
      'resize photo',
      'change image size',
      'scale image',
      'resize jpg',
      'resize png',
      'bulk image resize',
      'photo dimensions',
    ],
    category: 'image-edit',
    icon: 'Scaling',
    popular: true,
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
    faqs: [
      {
        q: 'Will resizing make my image blurry?',
        a: 'Downscaling uses a lanczos3 filter, a high-quality resampler, so detail stays crisp. Enlarging past the original pixel count always softens an image, because the new pixels must be invented. The "don’t enlarge" option is on by default to prevent that.',
      },
      {
        q: 'Can I resize many images at once?',
        a: 'Yes. Drop in as many files as you like, and each one is resized with the same rule. When the aspect ratio is locked, each image keeps its own proportions and is not stretched to a shared shape. Results download one by one or as one ZIP.',
      },
      {
        q: 'Does the file stay in its original format?',
        a: 'Yes, by default: a JPEG comes back as a JPEG, a PNG as a PNG. AVIF, GIF and BMP inputs are saved as PNG, because browsers cannot encode those formats. You can also force JPEG, PNG or WebP output.',
      },
      {
        q: 'Is there a file size or count limit?',
        a: 'No. The work happens on your device, so the only limit is its memory. Large batches of 50-megapixel photos can be slow on a phone. A laptop handles them.',
      },
      {
        q: 'What size should I use for social media?',
        a: 'The preset list covers the current recommended sizes: 1080 × 1080 for an Instagram square, 1080 × 1920 for stories and Reels, 1280 × 720 for a YouTube thumbnail, 1500 × 500 for an X header and 1584 × 396 for a LinkedIn banner.',
      },
    ],
    related: ['compress-image', 'crop-image', 'circle-crop-image', 'jpg-to-png', 'png-to-jpg', 'watermark-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'crop-image',
    title: 'Crop Image',
    h1: 'Crop an image online',
    description:
      'Crop an image with a drag-and-resize selection, aspect ratio presets such as 16:9, or exact pixel values. The kept pixels are not resampled.',
    keywords: [
      'photo cropper',
      'crop picture',
      'cut image',
      'crop jpg',
      'crop png',
      'aspect ratio crop',
      'trim image',
    ],
    category: 'image-edit',
    icon: 'Crop',
    popular: true,
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
    faqs: [
      {
        q: 'Does cropping reduce quality?',
        a: 'Cropping removes pixels but never resamples the pixels it keeps, so the kept area is identical to the original. A JPEG output is compressed once more. Keep the quality slider at 90 or above, or export PNG, to make that step lossless in practice.',
      },
      {
        q: 'How do I crop to an exact size?',
        a: 'Type the numbers in the Width and Height boxes. They are in pixels of the original image, and the X/Y boxes set the top-left corner of the selection. So you can make an exact 1200 × 630 crop for an Open Graph image.',
      },
      {
        q: 'Can I crop without a mouse?',
        a: 'Yes. Tab to the crop box. Arrow keys move it one pixel, Shift + arrows move it 20 pixels, and Alt + arrows resize it. The X/Y/W/H fields also work with a keyboard and stay in sync with the drag handles.',
      },
      {
        q: 'What aspect ratio should I choose?',
        a: '1:1 for profile pictures and Instagram squares, 16:9 for video thumbnails and slides, 9:16 for stories and Reels, 3:2 for prints from most cameras, and 4:3 for older sensors and many phone screenshots.',
      },
    ],
    related: ['resize-image', 'circle-crop-image', 'rotate-image', 'compress-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-image',
    title: 'Compress Image',
    h1: 'Compress images online',
    description:
      'Compress images (JPG, PNG or WebP) by quality or to a target size in KB. A slider compares the original and the result side by side.',
    keywords: [
      'image compressor',
      'reduce image size',
      'compress jpeg',
      'compress png',
      'shrink photo',
      'optimize image',
      'compress image to 100kb',
      'reduce photo file size',
    ],
    category: 'image-edit',
    icon: 'Shrink',
    popular: true,
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'How does "target file size" work?',
        a: 'The tool encodes your image up to ten times and halves the search range each round, until it finds the highest quality that fits under your limit. This is a binary search on the quality value, and the result is usually within a few percent of your target.',
      },
      {
        q: 'Why does the PNG barely shrink?',
        a: 'PNG is lossless, so it has no quality setting. The only way to make it smaller is fewer pixels. For photographs, change the output format to JPEG or WebP for a reduction of 80–95%. For screenshots and flat graphics, PNG is already the correct format.',
      },
      {
        q: 'What quality setting should I use?',
        a: 'For photographs on the web, 75–85 is the usual range: the file is a fraction of the original, and you cannot see the difference at normal size. Below 50, blocks appear around hard edges and bands appear in skies.',
      },
      {
        q: 'Is WebP really smaller than JPEG?',
        a: 'For the same visual quality, WebP files are typically 25–35% smaller than JPEG. Every current browser supports it. Keep a JPEG copy only if the file has to work in very old software.',
      },
      {
        q: 'Are my photos uploaded anywhere?',
        a: 'No. The encoder runs in this page on the CPU of your device. Turn on airplane mode and the tool still works, which shows that nothing is sent.',
      },
    ],
    related: ['resize-image', 'jpg-to-webp', 'png-to-jpg', 'crop-image', 'remove-exif-data'],
    updated: '2026-11-01',
  },
  {
    slug: 'rotate-image',
    title: 'Rotate Image',
    h1: 'Rotate an image online',
    description:
      'Rotate an image 90°, 180° or any angle. The canvas grows to fit, and you choose the corner fill: transparent, white, black or a custom colour.',
    keywords: [
      'rotate photo',
      'turn image',
      'straighten photo',
      'rotate jpg',
      'rotate png 90 degrees',
      'fix sideways photo',
      'tilt image',
    ],
    category: 'image-edit',
    icon: 'RotateCw',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
    faqs: [
      {
        q: 'Why is my photo sideways in the first place?',
        a: 'Phones and cameras usually save the sensor image unrotated and record an EXIF "orientation" tag instead. Software that ignores the tag shows the photo on its side. Rotating here bakes the correct orientation into the pixels, so it looks right everywhere.',
      },
      {
        q: 'What happens to the corners at odd angles?',
        a: 'The canvas grows to the rotated bounding box, so nothing is clipped. The four corner triangles are filled with the background you pick: transparent, white, black or a custom colour. Transparent needs PNG or WebP output. JPEG uses white.',
      },
      {
        q: 'Does rotating by 90° lose quality?',
        a: 'At 90, 180 and 270 degrees the pixel grid maps exactly, so no resampling happens. At other angles the pixels are interpolated, which softens fine detail very slightly. This happens in every editor.',
      },
      {
        q: 'Can I straighten a crooked scan?',
        a: 'Yes. Use the angle slider or type a decimal value such as -1.4 to level a horizon or a scanned page, then crop away the filled corners with the crop tool.',
      },
    ],
    related: ['flip-image', 'crop-image', 'resize-image', 'compress-image', 'image-metadata-viewer'],
    updated: '2026-11-01',
  },
  {
    slug: 'flip-image',
    title: 'Flip Image',
    h1: 'Flip an image online',
    description:
      'Flip an image horizontally, vertically or both, with a live preview. Flip a whole batch with the same settings and download one ZIP.',
    keywords: [
      'mirror image',
      'flip photo',
      'reverse image',
      'flip horizontally',
      'flip vertically',
      'mirror selfie',
    ],
    category: 'image-edit',
    icon: 'FlipHorizontal',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
    faqs: [
      {
        q: 'What is the difference between flipping and rotating?',
        a: 'Flipping mirrors the image across an axis and makes a reversed copy, so text reads backwards. Rotating turns the image without a mirror, so text stays readable. A flip both horizontally and vertically is the same as a 180° rotation.',
      },
      {
        q: 'Why does my selfie look wrong when flipped?',
        a: 'Most phone cameras mirror the front-facing preview so it behaves like a mirror, then save the unmirrored version. Flipping horizontally gives you back the view you saw on screen, which usually looks more natural to you and stranger to everyone else.',
      },
      {
        q: 'Is any quality lost?',
        a: 'Flipping only moves pixels, so it is lossless. The only quality change comes from encoding a JPEG again. Export PNG or WebP to prevent it.',
      },
      {
        q: 'Can I flip several images at once?',
        a: 'Yes. Add as many as you like, pick the directions once, and download the results one by one or in one ZIP.',
      },
    ],
    related: ['rotate-image', 'crop-image', 'grayscale-image', 'resize-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'grayscale-image',
    title: 'Grayscale Image',
    h1: 'Convert an image to grayscale',
    description:
      'Convert an image to grayscale, sepia or negative, and adjust brightness, contrast and saturation with a live preview. Uses Rec. 709 luma weights.',
    keywords: [
      'black and white photo',
      'greyscale image',
      'sepia filter',
      'invert image colors',
      'desaturate photo',
      'photo filter',
      'brightness contrast',
    ],
    category: 'image-edit',
    icon: 'Contrast',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
    faqs: [
      {
        q: 'How is the grayscale value calculated?',
        a: 'Each pixel is converted with the Rec. 709 luma weights: 0.2126 red, 0.7152 green, 0.0722 blue. These weights match how the human eye sees brightness, so greens stay bright and blues stay dark, as in a correct black-and-white conversion.',
      },
      {
        q: 'In what order are the adjustments applied?',
        a: 'Brightness, then contrast, saturation, grayscale, sepia and invert. This is the order of a CSS filter chain, so the presets give the same result as a design tool.',
      },
      {
        q: 'Does it work on transparent PNGs?',
        a: 'Yes. The alpha channel is left untouched, so transparency is preserved through every adjustment and the exported PNG or WebP keeps its transparent areas.',
      },
      {
        q: 'Can I apply one look to many photos?',
        a: 'Yes. Set the sliders once using the live preview of the first image, then apply the same treatment to the whole batch and download a ZIP.',
      },
    ],
    related: ['compress-image', 'watermark-image', 'flip-image', 'crop-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'watermark-image',
    title: 'Watermark Image',
    h1: 'Add a watermark to images',
    description:
      'Watermark images with text or a logo. Set the position, opacity, scale, rotation and tiling, and apply the same watermark to a whole batch.',
    keywords: [
      'add watermark',
      'photo watermark',
      'copyright image',
      'logo on photo',
      'batch watermark',
      'text on image',
      'tiled watermark',
    ],
    category: 'image-edit',
    icon: 'Stamp',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
    faqs: [
      {
        q: 'Which works better, text or a logo?',
        a: 'A text line is quickest for a copyright notice, and it stays sharp at any size because it is drawn as vector text at full resolution. A transparent PNG logo is better for branding. You can tile both across the frame to make the mark hard to crop out.',
      },
      {
        q: 'How do I stop the watermark being cropped off?',
        a: 'Turn on tiling. The mark repeats edge to edge in a staggered grid, so no single crop removes it. A low opacity of 15–25% keeps a tiled watermark readable without ruining the photo.',
      },
      {
        q: 'Does the watermark scale with the image?',
        a: 'Yes. Text size, logo size and margin are all expressed as a percentage of the image width, so a batch containing a 6000 px photo and an 800 px thumbnail gets a proportionally identical mark.',
      },
      {
        q: 'Can the watermark be removed later?',
        a: 'No. It is burnt into the pixels. Keep your originals in a safe place before you run a batch.',
      },
    ],
    related: ['resize-image', 'compress-image', 'crop-image', 'grayscale-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'remove-exif-data',
    title: 'Remove EXIF Data',
    h1: 'Remove EXIF and metadata from images',
    description:
      'Remove EXIF data, GPS location, IPTC and XMP from photos before you share them. See what each file holds, strip it, and check the result.',
    keywords: [
      'strip exif',
      'remove metadata from photo',
      'delete gps from image',
      'clear photo location',
      'exif remover',
      'anonymize image',
      'privacy photo',
    ],
    category: 'image-edit',
    icon: 'ShieldCheck',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'heic'],
    faqs: [
      {
        q: 'What exactly is removed?',
        a: 'Everything except the pixels: EXIF (camera, lens, exposure, serial numbers), GPS coordinates, IPTC captions and credits, XMP blocks, JFIF headers, embedded colour profiles and camera thumbnails. The image is rebuilt from raw pixel data, so no metadata stays by accident.',
      },
      {
        q: 'How do I know it actually worked?',
        a: 'After encoding, each cleaned file is parsed again and its tag count is shown next to it. A green "verified clean" badge means that the second parse found zero tags.',
      },
      {
        q: 'Why does GPS in a photo matter?',
        a: 'A geotagged photo records where it was taken to within a few metres. Posting one from home, from a child’s school or from a hotel discloses that address to anyone who downloads the original file. Most social networks strip EXIF on upload, but email attachments, cloud links and messaging apps in "document" mode do not.',
      },
      {
        q: 'Does stripping metadata reduce image quality?',
        a: 'Encoding a JPEG again costs one generation of compression, so the default quality is 95, where you cannot see the loss. Choose PNG output for an exact pixel copy, at the cost of a larger file.',
      },
      {
        q: 'Is the file uploaded to check it?',
        a: 'No. Parsing and encoding both happen in this page, and nothing is sent.',
      },
    ],
    related: ['image-metadata-viewer', 'compress-image', 'resize-image', 'crop-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'image-metadata-viewer',
    title: 'Image Metadata Viewer',
    h1: 'View image EXIF and metadata',
    description:
      'Image metadata viewer for EXIF, IPTC, XMP and GPS data: camera, lens, exposure, dates and coordinates in readable groups, with a raw JSON export.',
    keywords: [
      'exif viewer',
      'photo metadata',
      'check image exif',
      'read exif online',
      'camera settings from photo',
      'gps from photo',
      'iptc xmp viewer',
    ],
    category: 'image-edit',
    icon: 'ScanEye',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'heic'],
    faqs: [
      {
        q: 'Which metadata standards are supported?',
        a: 'EXIF (including the GPS and Interop IFDs), IPTC-IIM, XMP, JFIF, PNG headers and ICC colour-profile descriptions. Values are translated into readable names and units, and the full untranslated set is available as JSON.',
      },
      {
        q: 'Why does my image show no metadata?',
        a: 'Screenshots, images exported from design tools and anything that has passed through Facebook, Instagram, WhatsApp or X usually have none: those services re-encode uploads and discard EXIF. A file straight off a camera or phone almost always has plenty.',
      },
      {
        q: 'What does the shutter speed notation mean?',
        a: 'Exposure time is shown as a fraction of a second: 1/250 s means the shutter was open for four milliseconds. Aperture is shown as an f-number. A smaller number means a wider opening and less depth of field.',
      },
      {
        q: 'Can I get the GPS position out?',
        a: 'Yes. Coordinates are shown in decimal degrees and in degrees-minutes-seconds. Copy either form with one click and paste it into a maps app.',
      },
    ],
    related: ['remove-exif-data', 'compress-image', 'resize-image', 'crop-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'circle-crop-image',
    title: 'Circle Crop Image',
    h1: 'Crop an image into a circle',
    description:
      'Circle crop an image into a round or rounded-square avatar with a transparent PNG background. Add a border and set the exact output size.',
    keywords: [
      'round profile picture',
      'circular crop',
      'avatar maker',
      'circle photo',
      'rounded corners image',
      'profile picture cropper',
      'transparent png avatar',
    ],
    category: 'image-edit',
    icon: 'CircleUser',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
    faqs: [
      {
        q: 'Will the corners really be transparent?',
        a: 'Yes. With PNG or WebP output, the area outside the circle has an alpha value of zero, so it disappears over any background. JPEG cannot store transparency. If you must export JPEG, pick a solid background colour.',
      },
      {
        q: 'What size should a profile picture be?',
        a: '512 × 512 is a safe universal choice. Slack and Discord display at 128, LinkedIn at 400, GitHub at 460 and most sites downscale from whatever you give them, so uploading a square 512 or 1024 covers every case without looking soft.',
      },
      {
        q: 'How do I choose which part of the photo is inside the circle?',
        a: 'The image is scaled to cover the frame, then you drag the preview to reposition it and use the zoom slider to pull in tighter. The horizontal and vertical sliders do the same job precisely, and with a keyboard.',
      },
      {
        q: 'Can I add a ring around the avatar?',
        a: 'Yes. Turn on the border and set its width as a percentage of the output size, so the ring stays proportional whether you export at 128 px or 1024 px.',
      },
    ],
    related: ['crop-image', 'resize-image', 'compress-image', 'favicon-generator'],
    updated: '2026-11-01',
  },
]
