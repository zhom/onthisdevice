import type { Tool } from './types'

/**
 * Round-2 batch `photo` — canvas and jsquash image work.
 *
 * Nine tools plus their sibling pages. Every entry here is a real URL with its
 * own copy: sibling pages share a React island but never share body text.
 */
export const tools: Tool[] = [
  /* ───────────────────────── meme / text on image ───────────────────────── */
  {
    slug: 'meme-generator',
    title: 'Meme Generator',
    h1: 'Meme generator with no watermark',
    description:
      'Meme generator with classic Impact captions and text boxes you drag into place. The download has no watermark and keeps the full image size.',
    keywords: ['meme maker', 'impact font meme', 'caption image', 'no watermark meme'],
    category: 'image-edit',
    icon: 'Smile',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    faqs: [
      {
        q: 'Will there be a watermark on my meme?',
        a: 'No. The tool exports the canvas you see and adds nothing to the image. There is no account and no paid version.',
      },
      {
        q: 'Why does my text not look like Impact?',
        a: 'Impact comes with Windows and macOS but not with most Linux distributions or Android. The page loads no remote fonts, so the generator uses the heaviest condensed sans font on your device. Pick “Heavy sans” in the font list for the same look on every device.',
      },
      {
        q: 'Can I put text below the image instead of on top of it?',
        a: 'Yes. Use the “white space below” slider to add a bar under the photo, then drag the caption into it. The caption then covers no part of the photo.',
      },
      {
        q: 'Does the meme keep the original resolution?',
        a: 'Yes. The preview is scaled down to fit your screen. The export draws each caption again at the full pixel size of the source image, so the text stays sharp.',
      },
      {
        q: 'Is my template image uploaded anywhere?',
        a: 'No. Your browser decodes the image, draws it on a canvas and encodes the result as a file. The tool also works with the network turned off.',
      },
    ],
    related: ['add-text-to-image', 'combine-images', 'compress-image-to-100kb', 'image-color-picker'],
    updated: '2026-11-01',
  },
  {
    slug: 'add-text-to-image',
    title: 'Add Text to Image',
    h1: 'Add text to an image online',
    description:
      'Add text to an image as a caption, label or watermark. Set the font, size, colour, outline and shadow, drag it into place and save as PNG or JPG.',
    keywords: ['write on photo', 'caption photo', 'text over image', 'photo text editor'],
    category: 'image-edit',
    icon: 'Type',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    faqs: [
      {
        q: 'Can I add more than one piece of text?',
        a: 'Yes. Press “Add text box” for each new label. Every box keeps its own font, size, colour, outline, alignment and position, and you can drag each one independently.',
      },
      {
        q: 'How do I make text readable over a busy photo?',
        a: 'Use two controls. A thin dark outline (5–10%) separates the letters from the detail behind them, and the drop shadow makes light text readable on a light background. Both are drawn into the exported pixels.',
      },
      {
        q: 'Which fonts can I use?',
        a: 'Any font installed on your device. The page loads no remote fonts, because that needs a network request. The list has the font families that come with Windows, macOS, iOS and Android.',
      },
      {
        q: 'Can I use this to watermark my photos?',
        a: 'Yes. Put a large, low-contrast caption across the middle, or a small one in a corner. A drawn watermark only discourages copying: a person can crop it or paint over it.',
      },
    ],
    related: ['meme-generator', 'combine-images', 'blur-face-in-photo', 'change-image-dpi'],
    updated: '2026-11-01',
  },

  /* ───────────────────────── masking family ───────────────────────── */
  {
    slug: 'blur-face-in-photo',
    title: 'Blur Face in Photo',
    h1: 'Blur faces in a photo',
    description:
      'Find and blur every face in a photo, also small faces in group shots. Keep the faces you choose and save without GPS or camera data.',
    keywords: ['face blur', 'blur faces automatically', 'hide face in photo', 'anonymise photo', 'blur people in photo', 'blur crowd'],
    category: 'redact',
    icon: 'ScanFace',
    popular: true,
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'Does it find the faces automatically?',
        a: 'Yes. A face detection model runs in your browser and finds faces down to about 10 pixels wide, also in large group photos. Faces seen from the side or from behind can be missed, so check the photo and drag a box over any face it did not mark.',
      },
      {
        q: 'Can I keep some faces visible?',
        a: 'Yes. Click a box on the photo, or turn it off in the list, and that face stays sharp. Click it again to hide it.',
      },
      {
        q: 'Is the photo uploaded?',
        a: 'No. Your browser opens the photo, finds the faces and saves the result. The model file downloads once from this site and is kept in your browser. Open the Network tab of the developer tools to check that no photo is sent.',
      },
      {
        q: 'Can the blur be undone?',
        a: 'Not from the saved file. The pixels in each box are replaced before the file is written. Keep the strength at 50% or more, or use the solid fill, so that no detail is left.',
      },
      {
        q: 'Does it remove the location of the photo?',
        a: 'Yes. The file is written again from the pixels, so EXIF data, GPS coordinates, the camera serial number and the embedded thumbnail are not in the result. That thumbnail matters: other editors often keep it, and it still shows the face.',
      },
    ],
    related: ['blur-faces-in-video', 'face-blur-camera', 'blur-license-plate', 'remove-exif-data'],
    updated: '2026-11-01',
  },
  {
    slug: 'pixelate-image',
    title: 'Pixelate Image',
    h1: 'Pixelate an image or part of one',
    description:
      'Pixelate an image or only part of it. Draw boxes over the areas to hide, or apply the mosaic to the whole picture, and set the block size.',
    keywords: ['mosaic effect', 'pixelate photo', 'block out image', 'pixelate part of picture'],
    category: 'image-edit',
    icon: 'Grid2x2',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'How large should the mosaic blocks be?',
        a: 'Large enough that no feature can be recognised. As a rule, the masked area should be no more than 6–8 blocks across. The strength slider is relative to the box you drew, so a small box gets proportionally larger blocks.',
      },
      {
        q: 'Is pixelation as safe as blurring?',
        a: 'For text it is weaker. Short, predictable strings such as a licence number or a date of birth have been recovered from coarse pixelation by brute force: each candidate goes through the same filter and is compared. For text, use the solid-block mode.',
      },
      {
        q: 'Can I pixelate the whole image?',
        a: 'Yes. Switch on “Apply to the whole image” and the tool ignores the boxes. Use this to make a placeholder or a low-detail preview of a screenshot.',
      },
      {
        q: 'What resolution does the export use?',
        a: 'The full resolution of the original. At export the tool calculates the mosaic again from the boxes you drew, so the result matches the preview at full size.',
      },
    ],
    related: ['blur-face-in-photo', 'censor-image', 'blur-license-plate', 'compress-image-to-100kb'],
    updated: '2026-11-01',
  },
  {
    slug: 'censor-image',
    title: 'Censor Image',
    h1: 'Censor an image before you share it',
    description:
      'Censor an image: cover names, addresses, card numbers or faces with a solid bar, blur or mosaic. The pixels under each box are replaced in the file.',
    keywords: ['black bar photo', 'redact image', 'hide information in screenshot', 'cover text in image'],
    category: 'redact',
    icon: 'EyeOff',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'Why is a solid block safer than a blur for text?',
        a: 'For short, structured text, blur and mosaic can be reversed: an attacker can render each possible string, apply the same filter and compare the results. A solid fill keeps no information, so there is nothing to compare.',
      },
      {
        q: 'Is this the same as drawing a rectangle in a screenshot app?',
        a: 'It is safer. Many editors, and all PDF and slide tools, store the rectangle as a separate object on top of the original image, which anyone can select and delete. This tool replaces the pixels under the box before it writes the file.',
      },
      {
        q: 'Does the censored file still contain my metadata?',
        a: 'No. The tool encodes the file again from the pixels, so EXIF, GPS, device details and the embedded preview thumbnail are removed. The thumbnail is the part that most often shows the uncensored original.',
      },
      {
        q: 'Can I censor a screenshot of a spreadsheet or a bank statement?',
        a: 'Yes. Drag a box over each figure, use the solid block, and check the preview before you export. The preview is a scaled-down copy of the pixels you download.',
      },
    ],
    related: ['blur-face-in-photo', 'pixelate-image', 'remove-exif-data', 'image-metadata-viewer'],
    updated: '2026-11-01',
  },
  {
    slug: 'blur-license-plate',
    title: 'Blur License Plate',
    h1: 'Hide a number plate in a photo',
    description:
      'Find the license plates in your car photos and cover them with a solid block or a blur. Save one photo or a ZIP, without the GPS tag.',
    keywords: ['hide number plate', 'blur license plate automatically', 'blur car registration', 'anonymise car photo', 'blur plate online'],
    category: 'redact',
    icon: 'Car',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'Does it find the plates automatically?',
        a: 'Yes. A plate detection model runs in your browser. It finds European, UK and US plates, also at an angle. Stickers and dealer badges are sometimes marked too, and small plates far away can be missed. Click a box to keep it visible, or drag to add one.',
      },
      {
        q: 'Blur or solid block for a plate?',
        a: 'Solid block, the default. A plate is short text with a known set of characters, and blurred or pixelated plates can sometimes be read again by testing every possible plate. A solid block leaves nothing to test.',
      },
      {
        q: 'Why hide a plate on a listing photo?',
        a: 'A plate links a car to its owner. With a photo of your street and the GPS tag that most phones add, it can also give away where the car is parked.',
      },
      {
        q: 'Can I do several photos of the same car?',
        a: 'Yes. Drop all the photos at once. Each one is checked for plates, and you can save them one at a time or together as a ZIP file.',
      },
      {
        q: 'Are the photos uploaded?',
        a: 'No. The photos are opened, checked and saved by your browser. The model downloads once from this site and then works offline.',
      },
    ],
    related: ['blur-face-in-photo', 'censor-image', 'remove-exif-data', 'blur-faces-in-video'],
    updated: '2026-11-01',
  },

  /* ───────────────────────── combine family ───────────────────────── */
  {
    slug: 'combine-images',
    title: 'Combine Images',
    h1: 'Combine images into one file',
    description:
      'Combine images into one file, side by side, stacked or in a grid. Set the gap, background colour and rounded corners, and drag to change the order.',
    keywords: ['merge photos', 'join images', 'stack images', 'image combiner'],
    category: 'image-edit',
    icon: 'Combine',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'],
    faqs: [
      {
        q: 'How many images can I combine?',
        a: 'As many as your device memory allows. There is no limit per file or per batch, because the canvas is built on your device.',
      },
      {
        q: 'What happens when the images are different sizes?',
        a: 'You choose. “Keep every image at its own size” pads the smaller images as the alignment setting tells it. “Scale all to the smallest” never enlarges an image. “Scale all to the largest” makes all sizes match, but enlarges the small images.',
      },
      {
        q: 'Can I keep a transparent background?',
        a: 'Yes. Switch on “Transparent background” and export as PNG or WebP. JPG has no alpha channel, so a JPG export always fills the background colour first.',
      },
      {
        q: 'Does the order of the files matter?',
        a: 'Yes, and you can change it: drag the file chips above the preview. Order runs left to right for side-by-side, top to bottom for stacked, and row by row for the grid.',
      },
    ],
    related: ['merge-images-side-by-side', 'photo-collage-maker', 'meme-generator', 'compress-image-to-1mb'],
    updated: '2026-11-01',
  },
  {
    slug: 'merge-images-side-by-side',
    title: 'Merge Images Side by Side',
    h1: 'Merge images side by side',
    description:
      'Merge images side by side: put two or more photos next to each other in one image, with matched heights, a gap you set and a background colour.',
    keywords: ['photos next to each other', 'before after image', 'two pictures one image', 'horizontal merge'],
    category: 'image-edit',
    icon: 'Columns2',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'How do I make a before-and-after image?',
        a: 'Add the before shot first, then the after. Set height matching to “Scale all to the smallest” so both panels line up, and add a 10–20 px gap in a contrasting colour so the join is clear and the result does not look like one wide photo.',
      },
      {
        q: 'What happens when the two photos have different heights?',
        a: 'With matching switched off, the shorter photo is padded to the height of the taller one and positioned by the alignment control. With matching on, the shorter one is scaled up (or the taller one down) so both have the same height and no padding is needed.',
      },
      {
        q: 'Can I stack them vertically instead?',
        a: 'Yes, switch the direction to “Stacked”. Vertical stacking matches widths instead of heights, which suits screenshots of long pages.',
      },
      {
        q: 'Will the merged file lose quality?',
        a: 'Only if you export as JPG at a low quality. PNG export is lossless, and scaling uses a Lanczos-quality resample.',
      },
    ],
    related: ['combine-images', 'photo-collage-maker', 'compress-image-to-200kb', 'add-text-to-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'photo-collage-maker',
    title: 'Photo Collage Maker',
    h1: 'Photo collage maker',
    description:
      'Photo collage maker: arrange your photos in a grid and set the number of columns, the gap, rounded corners and the background colour.',
    keywords: ['collage maker', 'photo grid', 'picture collage', 'grid layout photos'],
    category: 'image-edit',
    icon: 'LayoutGrid',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'How do I choose the number of columns?',
        a: 'For a square-ish collage, use the square root of your photo count: four photos in 2 columns, nine in 3, sixteen in 4. For a story or banner strip, one column (or one row) with a small gap works better.',
      },
      {
        q: 'Why are some photos smaller than their grid cell?',
        a: 'Every cell is the size of the largest photo, and each image is fitted inside its cell without being cropped or distorted. The alignment control decides whether the spare space goes above, below or around it.',
      },
      {
        q: 'Can I print the collage?',
        a: 'Yes. Export as PNG for the sharpest result, then use Change Image DPI to tag it at 300 DPI so your printer lays it out at the right physical size instead of assuming 72.',
      },
      {
        q: 'Is there a limit on photo count or file size?',
        a: 'No. The only limit is your device memory. A 20-photo collage of 12-megapixel images makes a very large canvas, so set a maximum width first if your browser is slow.',
      },
    ],
    related: ['combine-images', 'merge-images-side-by-side', 'change-image-dpi', 'compress-image-to-1mb'],
    updated: '2026-11-01',
  },

  /* ───────────────────────── passport, colour, DPI ───────────────────────── */
  {
    slug: 'passport-photo-maker',
    title: 'Passport Photo Maker',
    h1: 'Passport photo maker: crop to any country size',
    description:
      'Crop a passport photo to US 2×2 in, UK/EU 35×45 mm, Schengen, India or China sizes at 300 DPI, with head-height guides and a printable 4×6 sheet.',
    keywords: ['passport photo', 'visa photo size', '2x2 photo', '35x45mm photo'],
    category: 'image-edit',
    icon: 'IdCard',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'Do you remove the background automatically?',
        a: 'No. That needs an AI segmentation model, which this tool does not use. The manual option is an edge flood fill that turns a plain wall white, with a tolerance slider so that it stops before it reaches hair or shoulders. A photo taken against a plain, evenly lit wall gives the most reliable result.',
      },
      {
        q: 'How do I get the head height right?',
        a: 'Drag the two dashed guides onto the crown of the head and the bottom of the chin, then zoom until the measured figure sits inside the range shown for your document. The tool converts the guides into millimetres using the physical photo size, so the check is the same one the passport office applies.',
      },
      {
        q: 'What DPI should I use?',
        a: '300 DPI is the standard for a printed passport photo and the value we write into the JPEG header. Use 600 only if a photo lab asks for it, and 200 only when an online portal caps the file size so hard that 300 will not fit.',
      },
      {
        q: 'How do I print the photos at the right size?',
        a: 'Download the 6 × 4 inch sheet and print it at 100%. Turn off “fit to page”, “shrink to printable area” and all border options, then cut along the light guides. Photo print services that print 6 × 4 also accept the file as it is.',
      },
      {
        q: 'Is my face uploaded to a server?',
        a: 'No. The crop, the guides and the sheet layout are canvas operations in your browser. Biometric photos of you and your children stay on your device.',
      },
    ],
    related: ['change-image-dpi', 'compress-image-to-100kb', 'blur-face-in-photo', 'combine-images'],
    updated: '2026-11-01',
  },
  {
    slug: 'image-color-picker',
    title: 'Image Color Picker',
    h1: 'Image colour picker with magnifier',
    description:
      'Image color picker with a magnifier: click any pixel to copy its HEX, RGB, HSL or Swift value, keep a history and extract the dominant palette.',
    keywords: ['eyedropper', 'hex from image', 'colour from photo', 'palette extractor'],
    category: 'image-edit',
    icon: 'Pipette',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
    faqs: [
      {
        q: 'How precise is the picker?',
        a: 'Exact. The image is read once into an ImageData buffer at full resolution, and the picker reads the RGBA value of the pixel from that buffer. It does not sample the scaled-down preview. The loupe shows the 11 × 11 pixels around the pointer.',
      },
      {
        q: 'Can I use it without a mouse?',
        a: 'Yes. Tab to the image, then use the arrow keys to move the sample point one pixel at a time (hold Shift for ten) and press Enter to lock the colour into the history.',
      },
      {
        q: 'How is the dominant palette calculated?',
        a: 'With median-cut quantisation, the same algorithm used to build GIF palettes: the pixel cloud is split repeatedly along its widest colour axis until there are as many boxes as swatches you asked for, then each box is averaged. The percentage next to each swatch is that box’s share of the sampled pixels.',
      },
      {
        q: 'Why does a JPG photo of a flat colour give slightly different values?',
        a: 'JPEG is lossy, so a nominally flat area varies by a few units per channel around block boundaries. Sample from the middle of the area, or from a PNG original, if you need the exact brand colour.',
      },
    ],
    related: ['meme-generator', 'combine-images', 'hex-to-rgb-converter', 'image-metadata-viewer'],
    updated: '2026-11-01',
  },

  /* ───────────────────────── compress-to-size family ───────────────────────── */
  {
    slug: 'compress-image-to-100kb',
    title: 'Compress Image to 100KB',
    h1: 'Compress an image to 100 KB',
    description:
      'Compress an image to 100 KB or less. A binary search over the quality setting finds the best file under the limit and lists every attempt.',
    keywords: ['reduce image to 100kb', 'image size 100kb', 'photo under 100kb', 'compress jpg 100kb'],
    category: 'image-edit',
    icon: 'Gauge',
    popular: true,
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'How does it hit the exact size?',
        a: 'It measures. No formula converts “quality 74” to “96 KB”, because the size depends on the picture. The tool encodes at quality 92, then does a binary search of the quality range and keeps the highest setting that fits. Ten encodes take less than a second, and every attempt is listed.',
      },
      {
        q: 'Is 100 KB 100,000 or 102,400 bytes?',
        a: 'The tool uses 1 KB = 1024 bytes and aims 2% under the limit, so the file fits both definitions. Upload forms compare against an exact byte limit and reject a file that is one byte over.',
      },
      {
        q: 'What if quality alone cannot get there?',
        a: 'The tool switches to a second search on the pixel dimensions, shrinking the image with a Lanczos filter until it fits. You can turn that off if the dimensions must stay exactly as they are.',
      },
      {
        q: 'Why do upload sites struggle with this?',
        a: 'Each attempt costs a server-based compressor a round trip, because each retry sends your photo again. Here the whole search runs on your CPU, so an exact target is practical.',
      },
      {
        q: 'Can I do a whole batch?',
        a: 'Yes. Drop in any number of images, each is searched separately to the same target, and you can download them individually or as one ZIP.',
      },
    ],
    related: [
      'compress-image-to-50kb',
      'compress-image-to-200kb',
      'compress-jpeg-to-100kb',
      'reduce-image-size-in-kb',
      'compress-image',
    ],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-image-to-20kb',
    title: 'Compress Image to 20KB',
    h1: 'Compress an image to 20 KB',
    description:
      'Compress an image to 20 KB for exam and government portals. When lower quality is not enough, the tool also reduces the pixel size.',
    keywords: ['image 20kb', 'photo under 20kb', 'signature 20kb', 'compress to 20kb'],
    category: 'image-edit',
    icon: 'Gauge',
    accepts: ['jpg', 'jpeg', 'png', 'webp'],
    faqs: [
      {
        q: 'Can a photograph really fit in 20 KB?',
        a: 'Only if it is small in pixels. 20 KB holds about 300 × 400 pixels of photo detail at a usable quality, so the tool resizes when it must. Signatures and scanned documents fit more easily because they are mostly flat white.',
      },
      {
        q: 'What can I do when the result looks blocky?',
        a: 'Crop tightly before you compress. The encoder spends no bits on pixels you remove, so a tight crop at 20 KB looks much better than a full scene at the same size.',
      },
      {
        q: 'Which format is best at this size?',
        a: 'WebP. It typically holds 25–35% more detail than JPEG at the same small byte count. Use JPEG only if the portal asks for .jpg.',
      },
      {
        q: 'Is the aspect ratio preserved when it resizes?',
        a: 'Always. The resize search scales width and height by the same factor, so nothing is stretched.',
      },
    ],
    related: ['compress-image-to-50kb', 'compress-image-to-100kb', 'reduce-image-size-in-kb', 'compress-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-image-to-50kb',
    title: 'Compress Image to 50KB',
    h1: 'Compress an image to 50 KB',
    description:
      'Compress an image to 50 KB for job portals, exam forms and ID uploads. The result shows each search step and the exact final size in bytes.',
    keywords: ['image 50kb', 'photo under 50kb', 'compress to 50kb', 'passport photo 50kb'],
    category: 'image-edit',
    icon: 'Gauge',
    accepts: ['jpg', 'jpeg', 'png', 'webp'],
    faqs: [
      {
        q: 'What size photo fits comfortably in 50 KB?',
        a: 'About 600 × 800 pixels of a normal portrait, or a full-width 1000 px landscape with simple content. Detailed scenes (foliage, crowds, film grain) must be smaller because they have much more high-frequency detail.',
      },
      {
        q: 'What if the portal wants a size between 20 and 50 KB?',
        a: 'Set the target to 50 KB and check the achieved size in the result card. If it is below 20 KB, raise the target a little or use a larger source image. The search always returns the best-quality file that fits.',
      },
      {
        q: 'Does compressing twice make it smaller?',
        a: 'It makes it worse. Each JPEG generation quantises coefficients that were already rounded, so artefacts add up. Always start again from your original file. Do not compress a compressed file again.',
      },
      {
        q: 'Can I keep a PNG as a PNG?',
        a: 'Yes, but PNG is lossless, so the only lever is pixel dimensions. For photographs you will get a far better-looking 50 KB file by choosing JPG or WebP output.',
      },
    ],
    related: ['compress-image-to-20kb', 'compress-image-to-100kb', 'compress-image-to-200kb', 'passport-photo-maker'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-image-to-200kb',
    title: 'Compress Image to 200KB',
    h1: 'Compress an image to 200 KB',
    description:
      'Compress an image to 200 KB, a size that suits full-width web images and most application forms. A 1600 px photo usually fits at quality 75–82.',
    keywords: ['image 200kb', 'compress to 200kb', 'photo under 200kb', 'reduce jpg to 200kb'],
    category: 'image-edit',
    icon: 'Gauge',
    accepts: ['jpg', 'jpeg', 'png', 'webp'],
    faqs: [
      {
        q: 'Is 200 KB enough for a good-looking web image?',
        a: 'Yes. A 1600 px-wide hero photo at quality 75–82 is usually between 120 and 200 KB, which is inside the budget that most performance audits ask for.',
      },
      {
        q: 'Should I resize as well?',
        a: 'Usually. A 4000 px photo shown in an 800 px column has 25 times more pixels than it needs. Set a maximum width first, and the same 200 KB gives a much sharper picture.',
      },
      {
        q: 'Does it strip metadata?',
        a: 'Yes, as a side effect of re-encoding from raw pixels. EXIF blocks, colour profiles and camera thumbnails can add 20–80 KB on their own, which is a large share of a 200 KB budget.',
      },
      {
        q: 'Can I compress a batch to the same limit?',
        a: 'Yes. Every image gets its own independent search to the same target, and “Download all as .zip” bundles the results.',
      },
    ],
    related: ['compress-image-to-100kb', 'compress-image-to-500kb', 'reduce-image-size-in-kb', 'compress-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-image-to-500kb',
    title: 'Compress Image to 500KB',
    h1: 'Compress an image to 500 KB',
    description:
      'Compress an image to 500 KB, the usual limit for email attachments, forum posts and marketplace listings. Most phone photos fit at quality 82–90.',
    keywords: ['image 500kb', 'compress to 500kb', 'photo under 500kb', 'email photo size'],
    category: 'image-edit',
    icon: 'Gauge',
    accepts: ['jpg', 'jpeg', 'png', 'webp'],
    faqs: [
      {
        q: 'Will 500 KB visibly damage my photo?',
        a: 'Rarely. Most 12-megapixel phone photos land in the 82–90 quality band at 500 KB, which is above the threshold where artefacts become visible at normal viewing size.',
      },
      {
        q: 'How many photos fit in a 25 MB email?',
        a: 'About 45 at 500 KB each. But mail servers count the base64 encoding overhead, which adds about a third, so plan for about 35.',
      },
      {
        q: 'Is WebP safe to email?',
        a: 'Modern mail clients show it, but some older desktop clients and print shops do not. For an attachment that another person opens, JPG is safer. For your own website, use WebP.',
      },
      {
        q: 'Can I keep the original dimensions?',
        a: 'Yes. Switch off “Shrink if quality is not enough”. At a 500 KB target the quality search almost always succeeds alone, so the tool rarely resizes.',
      },
    ],
    related: ['compress-image-to-200kb', 'compress-image-to-1mb', 'compress-image', 'blur-license-plate'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-image-to-1mb',
    title: 'Compress Image to 1MB',
    h1: 'Compress an image to 1 MB',
    description:
      'Compress an image to 1 MB for CMS uploads and print previews. A 24-megapixel photo usually fits at quality 70–80 with no change to its resolution.',
    keywords: ['image 1mb', 'compress to 1mb', 'photo under 1mb', 'reduce photo size 1mb'],
    category: 'image-edit',
    icon: 'Gauge',
    accepts: ['jpg', 'jpeg', 'png', 'webp'],
    faqs: [
      {
        q: 'Can I keep the full resolution at 1 MB?',
        a: 'Usually yes. Even a 24-megapixel photo generally fits inside 1 MB at quality 70–80 without resizing, so the tool leaves the pixel dimensions alone unless the quality search fails.',
      },
      {
        q: 'Is 1 MB good enough for printing?',
        a: 'For a 6 × 4 in print, yes. For A3 or larger, the pixel dimensions decide: you need about 240–300 pixels per printed inch.',
      },
      {
        q: 'How do I know how much quality I lost?',
        a: 'Expand “Show the search” in the result card. It lists every encode, its quality setting and the resulting byte count, so you can see exactly which setting was chosen and how close the neighbouring ones came.',
      },
      {
        q: 'Does a target of 1 MB mean 1,000,000 bytes?',
        a: 'The tool uses 1 MB = 1024 KB = 1,048,576 bytes and aims 2% under, so the result fits both definitions.',
      },
    ],
    related: ['compress-image-to-500kb', 'compress-image-to-200kb', 'photo-collage-maker', 'compress-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-jpeg-to-100kb',
    title: 'Compress JPEG to 100KB',
    h1: 'Compress a JPEG to 100 KB',
    description:
      'Compress a JPEG to 100 KB with the MozJPEG encoder in WebAssembly. A search measures each quality setting and keeps the best one that fits.',
    keywords: ['jpeg 100kb', 'jpg under 100kb', 'reduce jpeg size', 'mozjpeg compress'],
    category: 'image-edit',
    icon: 'Gauge',
    accepts: ['jpg', 'jpeg'],
    faqs: [
      {
        q: 'What encoder is used?',
        a: 'MozJPEG, compiled to WebAssembly and running in your browser. It typically makes files 5–15% smaller than the browser’s own JPEG encoder at the same visual quality. That difference matters when the limit is a fixed 100 KB.',
      },
      {
        q: 'Does re-encoding a JPEG lose quality?',
        a: 'Yes. A JPEG is decoded to pixels and quantised again, so some more loss is unavoidable. Start from the highest-quality copy you have, and do not run the same file through twice.',
      },
      {
        q: 'Why is my 100 KB result blurrier than someone else’s?',
        a: 'The content decides. Flat backgrounds and studio portraits compress very well. Foliage, water, textured fabric and film grain compress badly. So 100 KB gives different sharpness for different pictures.',
      },
      {
        q: 'Can it output WebP instead?',
        a: 'Yes. Change the output format. WebP holds more detail at 100 KB. Use JPG only if the site you upload to requires it.',
      },
    ],
    related: ['compress-image-to-100kb', 'compress-png-to-100kb', 'compress-image-to-200kb', 'jpg-to-webp'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-png-to-100kb',
    title: 'Compress PNG to 100KB',
    h1: 'Compress a PNG to 100 KB',
    description:
      'Compress a PNG to 100 KB. Keep it lossless and let the tool reduce the pixel size, or convert a photo to JPG or WebP for a much smaller file.',
    keywords: ['png 100kb', 'reduce png size', 'png under 100kb', 'shrink png'],
    category: 'image-edit',
    icon: 'Gauge',
    accepts: ['png'],
    faqs: [
      {
        q: 'Why is there no quality slider for PNG?',
        a: 'PNG is lossless, so it has no quality setting to search. The only control is the pixel count. With PNG output, the tool does a binary search of the scale factor and shows the dimensions it chose.',
      },
      {
        q: 'My PNG is a photo. What should I do?',
        a: 'Switch the output format to JPG or WebP. PNG stores photographic noise almost verbatim, so a photo saved as PNG is routinely ten times larger than the same picture as a JPEG at indistinguishable quality.',
      },
      {
        q: 'Will I lose transparency?',
        a: 'PNG and WebP keep the alpha channel. JPG has none, so transparent areas become solid. Use WebP if you need a small file and transparency.',
      },
      {
        q: 'Is PNG ever the right choice at 100 KB?',
        a: 'Yes, for screenshots, logos, line art, charts and anything with large flat areas and sharp text. Those compress extremely well losslessly, and JPEG would put visible ringing around every letter edge.',
      },
    ],
    related: ['compress-image-to-100kb', 'compress-jpeg-to-100kb', 'png-to-jpg', 'png-to-webp'],
    updated: '2026-11-01',
  },
  {
    slug: 'reduce-image-size-in-kb',
    title: 'Reduce Image Size in KB',
    h1: 'Reduce image size in KB to any target',
    description:
      'Reduce image size in KB to any target you type. The encoder searches the quality first, then the dimensions, and shows each step and the byte count.',
    keywords: ['reduce image size kb', 'custom size compress', 'image size reducer', 'resize photo kb'],
    category: 'image-edit',
    icon: 'ArrowDownWideNarrow',
    accepts: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    faqs: [
      {
        q: 'What target should I choose?',
        a: 'The size the form asks for. If it gives a range, use the top of the range, because the largest allowed file is the sharpest. If it gives no number, 200 KB is a good default for a web-quality photo.',
      },
      {
        q: 'How many attempts does the search take?',
        a: 'Ten for the quality pass and up to eight more for the resize pass. Each is a full encode on your device. The whole search takes about a second on a normal laptop, and the result lists every attempt.',
      },
      {
        q: 'Can I set a maximum width at the same time?',
        a: 'Yes. The tool applies the width limit before the search starts. This is usually the best way to reach a small target and keep the picture clean.',
      },
      {
        q: 'What if the target is impossible?',
        a: 'You still get the smallest file the tool could make, with a warning that the target was not met. Then crop the image or raise the limit.',
      },
    ],
    related: ['compress-image-to-100kb', 'compress-image-to-500kb', 'compress-image', 'resize-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'change-image-dpi',
    title: 'Change Image DPI',
    h1: 'Change image DPI (72 to 300 DPI)',
    description:
      'Change image DPI in a JPG or PNG without re-encoding the pixels: the tool writes the JFIF, EXIF and pHYs tags. Or resample to an exact print size.',
    keywords: ['300 dpi converter', 'change dpi of image', 'image resolution dpi', 'set dpi jpg'],
    category: 'image-edit',
    icon: 'Ruler',
    accepts: ['jpg', 'jpeg', 'png'],
    faqs: [
      {
        q: 'Does changing DPI improve image quality?',
        a: 'No. DPI is a label that tells how large one pixel is on paper. It does not change the pixels. A 600 × 600 image tagged 300 DPI prints at 2 × 2 inches. The same file tagged 72 DPI prints at 8.3 inches and looks blurry. The pixels are the same in both cases.',
      },
      {
        q: 'So why do submission forms ask for 300 DPI?',
        a: 'Their layout software reads the tag to set the physical size. A file with no tag defaults to 72 DPI, which makes it about four times too large. Setting the tag fixes this, and it is lossless.',
      },
      {
        q: 'Where is the DPI actually stored?',
        a: 'In JPEG it is in the JFIF APP0 segment (units plus X and Y density), and often also in the EXIF XResolution tags. In PNG it is the optional pHYs chunk, in pixels per metre. The tool changes all of them so that all readers agree, and adds the segment or chunk when the file has none.',
      },
      {
        q: 'What is the resample mode for?',
        a: 'Use it when the physical size must be exact and the pixel count must change to match. For example, 4 × 6 inches at 300 DPI becomes a 1200 × 1800 pixel image. This mode re-encodes with a Lanczos3 filter and warns you when it must upscale.',
      },
      {
        q: 'Why can I not set the DPI of a WebP or GIF?',
        a: 'Those containers have no standard density field, so there is nothing to write. Convert to JPG or PNG first, then set the DPI.',
      },
    ],
    related: ['passport-photo-maker', 'resize-image', 'compress-image-to-1mb', 'image-metadata-viewer'],
    updated: '2026-11-01',
  },

  /* ───────────────────────── icons ───────────────────────── */
  {
    slug: 'png-to-ico',
    title: 'PNG to ICO Converter',
    h1: 'PNG to ICO converter (multi-size favicon)',
    description:
      'Convert PNG to ICO: one multi-size favicon file with 16, 32, 48 and 256 px images, plus the HTML link tags to copy into your page.',
    keywords: ['favicon ico', 'png to icon', 'ico converter', 'make favicon'],
    category: 'image-convert',
    icon: 'Boxes',
    popular: true,
    accepts: ['png', 'jpg', 'jpeg', 'webp', 'avif'],
    faqs: [
      {
        q: 'Why does an .ico need several sizes?',
        a: 'Because different places pick different layers out of the same file: 16 px for the browser tab and address bar, 32 px for the taskbar and high-DPI tabs, 48 px for the Windows desktop, and 256 px for Explorer’s large-icon view. One 256 px image scaled down on the fly looks muddy at 16 px.',
      },
      {
        q: 'Are the images inside stored as PNG or BMP?',
        a: 'PNG. Windows Vista and later read PNG images inside an ICO file, and PNG is much smaller than the old BMP-DIB layout. A 256 px BMP entry alone is 256 KB.',
      },
      {
        q: 'My logo is not square. What happens?',
        a: 'By default it is padded to a square so the proportions survive, with a transparent background unless you type a colour. Turning padding off stretches the image to a square instead, which distorts most logos.',
      },
      {
        q: 'Where do I put the file?',
        a: 'At the root of your site as /favicon.ico. Browsers request that path even when the page has no link tag. The tags shown on the page also let you add an SVG icon and an Apple touch icon.',
      },
      {
        q: 'Is anything uploaded?',
        a: 'No. The resize, the PNG encoding and the ICO file are all made in the page.',
      },
    ],
    related: ['ico-to-png', 'favicon-generator', 'png-to-webp', 'resize-image'],
    updated: '2026-11-01',
  },
  {
    slug: 'ico-to-png',
    title: 'ICO to PNG Converter',
    h1: 'ICO to PNG converter',
    description:
      'Convert ICO to PNG: extract every image in an .ico file as a PNG, also old 4-bit and 8-bit BMP entries with their transparency masks.',
    keywords: ['ico to png', 'extract icon', 'open ico file', 'convert favicon to png'],
    category: 'image-convert',
    icon: 'FileImage',
    accepts: ['ico'],
    faqs: [
      {
        q: 'Why does one .ico produce several PNGs?',
        a: 'An .ico file is a container. It holds an icon directory and one bitmap for each size and colour depth, often six or more. The tool extracts each one as a separate file.',
      },
      {
        q: 'Can it read old Windows icons?',
        a: 'Yes. Alongside modern PNG payloads it decodes classic BMP-DIB entries at 1, 4, 8, 24 and 32 bits per pixel, applies the 1-bit AND transparency mask, and flips the bottom-up row order that DIB uses.',
      },
      {
        q: 'Is the PNG re-encoded or copied out?',
        a: 'When the entry is already a PNG we copy the bytes out untouched, so the result is bit-for-bit what was inside the file. BMP entries have to be converted, and the tool labels which is which.',
      },
      {
        q: 'Does it work with .cur cursor files?',
        a: 'Cursors use the same container with a different type flag, so the images extract. The hotspot coordinates stored in the directory entry are not preserved, because PNG has nowhere to put them.',
      },
    ],
    related: ['png-to-ico', 'favicon-generator', 'image-metadata-viewer', 'png-to-jpg'],
    updated: '2026-11-01',
  },

  /* ───────────────────────── ratio calculators ───────────────────────── */
  {
    slug: 'aspect-ratio-calculator',
    title: 'Aspect Ratio Calculator',
    h1: 'Aspect ratio calculator',
    description:
      'Aspect ratio calculator: find the missing width or height, simplify W:H with the GCD and see the megapixels. Presets for 16:9, 4:5 and 9:16.',
    keywords: ['ratio calculator', '16:9 calculator', 'resize proportionally', 'pixel ratio'],
    category: 'units',
    icon: 'Proportions',
    popular: true,
    faqs: [
      {
        q: 'How do I keep an image proportional when resizing?',
        a: 'Enter the original width and height as the ratio, then type the new width. The calculator finds the height with newHeight = newWidth × ratioHeight ÷ ratioWidth and shows the calculation with your numbers.',
      },
      {
        q: 'What ratio is 1920 × 1080?',
        a: '16:9. The greatest common divisor of 1920 and 1080 is 120, and dividing both by it gives 16:9. Type any pair of dimensions into the width and height boxes and the simplified ratio appears immediately.',
      },
      {
        q: 'Why is 21:9 shown as 64:27?',
        a: '“21:9” is a marketing name. Real ultrawide panels are 2560 × 1080 or 3440 × 1440, and both reduce to 64:27. That is 2.370:1. A true 21:9 is 2.333:1.',
      },
      {
        q: 'What are the common social media ratios?',
        a: '1:1 for a square feed post, 4:5 for the tallest allowed in-feed portrait, 9:16 for Stories, Reels, Shorts and TikTok, and 16:9 for YouTube and most landscape video. All of them are preset buttons on this page.',
      },
      {
        q: 'Does a ratio have to use whole numbers?',
        a: 'No. Cinema scope is 2.39:1 and ISO paper is √2:1 (about 1.414:1). Type decimals into the ratio boxes and the calculator shows a decimal ratio. It does not round to a misleading pair of whole numbers.',
      },
    ],
    related: ['screen-size-calculator', 'resize-image', 'crop-video', 'combine-images'],
    updated: '2026-11-01',
  },
  {
    slug: 'screen-size-calculator',
    title: 'Screen Size Calculator',
    h1: 'Screen size calculator: diagonal to width and height',
    description:
      'Screen size calculator: convert a diagonal to width, height, area and pixel density for any aspect ratio, with the Pythagoras steps shown.',
    keywords: ['tv size calculator', 'monitor dimensions', 'ppi calculator', 'screen diagonal to width'],
    category: 'units',
    icon: 'Monitor',
    faqs: [
      {
        q: 'How wide is a 27-inch monitor?',
        a: 'A 16:9 panel is about 23.5 inches (59.8 cm) wide and 13.2 inches (33.6 cm) tall, plus the bezel and stand. The diagonal alone does not tell you if a screen fits a desk or a wall recess. This page converts it to width and height.',
      },
      {
        q: 'Why are two screens with the same diagonal different sizes?',
        a: 'The shape is different. A 34-inch 21:9 ultrawide is much wider but much shorter than a 34-inch 16:9 panel, and a 4:3 screen with the same diagonal has more area than both. Area depends on the shape as well as the diagonal.',
      },
      {
        q: 'What is a good PPI?',
        a: 'About 90–110 PPI is the usual desktop value (a 27-inch 1440p panel is 109). About 140–180 looks sharper, and above about 200 you cannot see single pixels at normal desk distance. A 27-inch 4K panel is 163, and a 14-inch laptop at 2880 × 1800 is about 243.',
      },
      {
        q: 'How is the width calculated?',
        a: 'With Pythagoras. If r is width ÷ height, then width = diagonal × r ÷ √(r² + 1) and height = diagonal ÷ √(r² + 1). The page prints those two lines with your numbers filled in so you can check the result by hand.',
      },
      {
        q: 'Does this work for phones and tablets?',
        a: 'Yes. Enter the diagonal and the ratio (19.5:9 and 20:9 are common for phones, 4:3 and 3:2 for tablets) and add the resolution to get the pixel density. A phone with a notch is usually measured as if the display were a full rectangle.',
      },
    ],
    related: ['aspect-ratio-calculator', 'cm-to-inches', 'px-to-rem-converter', 'resize-image'],
    updated: '2026-11-01',
  },
]
