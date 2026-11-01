import type { Tool } from './types'

export const tools: Tool[] = [
  {
    slug: 'qr-code-generator',
    title: 'QR Code Generator',
    h1: 'QR code generator with logo, colours and SVG export',
    description:
      'QR code generator for links, text and phone numbers. Set the size, colours, quiet zone and error correction, add a logo, and save as PNG or SVG.',
    keywords: [
      'qr code maker',
      'free qr code generator',
      'qr code with logo',
      'custom qr code',
      'qr code svg',
      'url to qr code',
      'high resolution qr code',
      'qr code no expiry',
    ],
    category: 'generators',
    icon: 'QrCode',
    popular: true,
    faqs: [
      {
        q: 'Do these QR codes ever expire or need a subscription?',
        a: 'No. The code holds the text you typed directly. There is no redirect service, tracking link or account. The downloaded image does not expire, works offline and does not depend on this site.',
      },
      {
        q: 'How large can a QR code be before it stops scanning?',
        a: 'A symbol holds up to 4,296 alphanumeric or 2,953 binary characters, but a long payload gives a dense code that cheap cameras read badly. Keep URLs under about 300 characters, and use a link shortener or a landing page for longer content.',
      },
      {
        q: 'Will adding a logo break the code?',
        a: 'Not if you stay inside the error-correction budget. Level H can recover about 30% of a damaged symbol, so a logo up to about 28% of the width is usually safe. The tool warns you when the logo is larger than the current level can recover. Always test the printed result with a real phone.',
      },
      {
        q: 'Why does my code stop working when I invert the colours?',
        a: 'Almost every decoder expects dark modules on a light background. Light-on-dark codes fail on many Android cameras and most dedicated scanners. Keep a contrast ratio of at least 4:1, with the dark colour darker than the background. The tool shows the ratio and flags an inversion.',
      },
      {
        q: 'What size should I print it at?',
        a: 'As a rule, the symbol should be at least a tenth of the scanning distance: 3 cm for a 30 cm read on a business card, 10 cm for a metre, and much larger for posters. Export the SVG for print so the edges stay sharp at any size.',
      },
    ],
    related: ['wifi-qr-code-generator', 'vcard-qr-code-generator', 'barcode-generator', 'svg-to-png', 'favicon-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'wifi-qr-code-generator',
    title: 'WiFi QR Code Generator',
    h1: 'Wi-Fi QR code generator',
    description:
      'Make a WiFi QR code from your network name and password, so guests scan it to join. Supports WPA, WPA2, WPA3, WEP, open and hidden networks.',
    keywords: [
      'wifi qr code',
      'wifi password qr code',
      'guest wifi qr',
      'wpa3 qr code',
      'hidden network qr code',
      'wifi card printable',
      'scan to connect wifi',
    ],
    category: 'generators',
    icon: 'Wifi',
    faqs: [
      {
        q: 'Which phones can join a network from a QR code?',
        a: 'Every iPhone since iOS 11 and every Android since 10 handles the WIFI: scheme from the built-in camera. Older Androids need a QR app that supports it. Windows and macOS do not join networks from a QR code, so keep the password written down for laptops.',
      },
      {
        q: 'Is my password safe here?',
        a: 'Your browser turns the password into the QR image. The password is not sent, and this site has no server that could receive it. But anyone who can photograph the image can join your network, so treat a printed copy like the password itself.',
      },
      {
        q: 'What is the difference between WPA/WPA2 and WPA3?',
        a: 'WPA3 uses SAE, a different handshake, and is encoded as T:SAE. WPA and WPA2 are encoded as T:WPA. Most routers that run WPA3 also accept WPA2 clients in a transition mode. In that case, choose WPA/WPA2, because every phone understands it.',
      },
      {
        q: 'Why does the code fail on a hidden network?',
        a: 'A hidden network needs the H:true flag, which tells the phone to probe for the SSID. Without it, the phone waits to see the SSID advertised. Turn the hidden switch on only if the router suppresses its SSID. If it is set wrongly, some Android builds refuse to connect.',
      },
      {
        q: 'Do special characters in the password work?',
        a: 'Yes. Backslash, semicolon, comma, colon and double-quote are reserved in the WIFI: format and are escaped automatically. You can check the exact payload in the expandable panel under the code.',
      },
    ],
    related: ['qr-code-generator', 'vcard-qr-code-generator', 'password-generator', 'passphrase-generator', 'barcode-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'vcard-qr-code-generator',
    title: 'vCard QR Code Generator',
    h1: 'vCard QR code generator for business cards',
    description:
      'Make a vCard QR code that saves your name, phone, email, company and address to a phone in one scan. Uses vCard 3.0, with a .vcf download.',
    keywords: [
      'vcard qr code',
      'contact qr code',
      'business card qr code',
      'digital business card',
      'meCard generator',
      'vcf qr code',
      'save contact qr',
    ],
    category: 'generators',
    icon: 'Contact',
    faqs: [
      {
        q: 'Which vCard version does this produce?',
        a: 'vCard 3.0, the version with the widest support across iOS, Android, Outlook and Google Contacts. vCard 4.0 is newer but is still read inconsistently by phone cameras, and the extra features it adds are not useful inside a QR code.',
      },
      {
        q: 'Why is my QR code so dense?',
        a: 'A vCard carries far more text than a URL, and every field you fill in adds to it. Drop the address and the note first, use one phone number instead of three, and keep the correction level at L or M. A smaller, cleaner symbol scans better than a dense one with high correction.',
      },
      {
        q: 'Should I use a vCard code or a link to a contact page?',
        a: 'A vCard works offline and saves the contact in one tap. Use it on a printed business card or a conference badge. A link is better if the details change often, because you can update the page without reprinting anything.',
      },
      {
        q: 'What happens to accented characters and emoji?',
        a: 'They are encoded as UTF-8 inside the QR code and show correctly on modern phones. Some very old contact apps show them wrongly. Before a print run, scan the code with an iPhone and an Android phone.',
      },
    ],
    related: ['qr-code-generator', 'wifi-qr-code-generator', 'barcode-generator', 'signature-generator', 'meta-tag-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'barcode-generator',
    title: 'Barcode Generator',
    h1: 'Barcode generator: Code 128, EAN, UPC, ITF and more',
    description:
      'Generate Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF-14, MSI, Pharmacode and Codabar barcodes with check digits, print sizing and PNG or SVG export.',
    keywords: [
      'code 128 generator',
      'ean 13 generator',
      'upc barcode generator',
      'itf 14 barcode',
      'codabar generator',
      'barcode svg',
      'check digit calculator',
      'free barcode maker',
    ],
    category: 'generators',
    icon: 'Barcode',
    faqs: [
      {
        q: 'Which symbology should I use?',
        a: 'Code 128 for anything internal: it takes all of ASCII and gives the shortest symbol. EAN-13 or UPC-A only if you have a real GS1 company prefix, because retail scanners look the number up in a global database. ITF-14 for outer cases, Codabar for blood banks and libraries, Pharmacode for medicine cartons.',
      },
      {
        q: 'Does it calculate check digits?',
        a: 'Yes. Enter 12 digits for EAN-13, 11 for UPC-A, 7 for EAN-8 or 13 for ITF-14 and the modulo-10 check digit is appended for you. If you paste the full number instead, the tool verifies the check digit and tells you the correct one when it is wrong.',
      },
      {
        q: 'Can I sell products with a barcode I made here?',
        a: 'You can print any symbology here, but a retail EAN or UPC number must be issued to you by GS1. Inventing one risks colliding with another company’s product, and most retailers verify the prefix before they will stock an item.',
      },
      {
        q: 'What resolution do I need for printing?',
        a: 'Narrow bars must survive the printer and the scanner. For retail, the narrowest bar should be at least 0.264 mm, which means exporting the SVG or using the 4× PNG at 300 dpi or more. Never scale a small PNG up in a layout program. The bar edges blur and the scan fails.',
      },
      {
        q: 'Why will my red barcode not scan?',
        a: 'Laser scanners read in red light, so red, orange and pink bars look the same as a white background to them. Keep the bars black or a very dark blue-black, and never print light bars on a dark background.',
      },
    ],
    related: ['qr-code-generator', 'vcard-qr-code-generator', 'wifi-qr-code-generator', 'placeholder-image-generator', 'number-base-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'favicon-generator',
    title: 'Favicon Generator',
    h1: 'Favicon generator: full icon pack from one image',
    description:
      'Favicon generator: drop one logo and get every favicon size, a multi-size .ico, apple-touch-icon, site.webmanifest and the HTML snippet in a ZIP.',
    keywords: [
      'favicon ico generator',
      'apple touch icon',
      'site webmanifest generator',
      'png to ico',
      'favicon package',
      'android chrome icons',
      'favicon 16x16 32x32',
    ],
    category: 'generators',
    icon: 'AppWindow',
    accepts: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'],
    faqs: [
      {
        q: 'What size should my source image be?',
        a: 'Square and at least 512 × 512 pixels, or an SVG. The tool scales every size down from a 1024 px master with stepped halving, which keeps small sizes sharp. A 64 px source scaled up to 512 cannot get new detail and always looks soft.',
      },
      {
        q: 'Do I still need favicon.ico in 2026?',
        a: 'Yes, as a fallback. Browsers request /favicon.ico by default when no link tag matches, and a few feed readers, RSS clients and corporate proxies still expect it. It costs a couple of kilobytes, so include it.',
      },
      {
        q: 'How is the .ico file built?',
        a: 'The ICO container is a small header, one 16-byte directory entry per image, then the image payloads. This tool writes complete PNG files as those payloads at 16, 32 and 48 pixels. This is the PNG-in-ICO form that every browser and every supported Windows version reads.',
      },
      {
        q: 'Why does my icon look wrong on an iPhone home screen?',
        a: 'iOS ignores transparency in the apple-touch-icon and fills it with black, then applies its own rounded mask. Turn the background option on and give the icon a solid colour, and leave the corner radius at zero so iOS can apply its own shape.',
      },
      {
        q: 'Where do the files go?',
        a: 'All of them belong in the root of your site, next to index.html, and then the HTML snippet goes in the head of every page. If you serve them from a sub-folder, change the leading slash in each path to match.',
      },
    ],
    related: ['png-to-jpg', 'resize-image', 'svg-to-png', 'placeholder-image-generator', 'meta-tag-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'placeholder-image-generator',
    title: 'Placeholder Image Generator',
    h1: 'Placeholder image generator',
    description:
      'Placeholder image generator for any size, with your own colours, label and grid. Export PNG, WebP or SVG, or copy a data URI to paste into markup.',
    keywords: [
      'dummy image generator',
      'placeholder png',
      'placeholder svg',
      'mockup image',
      'data uri image',
      'og image size',
      'lorem picsum alternative',
    ],
    category: 'generators',
    icon: 'Frame',
    faqs: [
      {
        q: 'Why not use an online placeholder service?',
        a: 'Each image from such a service is an external HTTP request. It slows your prototype, shows the page you are building to a third party, and breaks when the service has an outage or rate-limits you. A local file or a data URI has none of those problems.',
      },
      {
        q: 'When should I use SVG instead of PNG?',
        a: 'For a placeholder, in most cases. The SVG output is a few hundred bytes, stays sharp at any zoom level, and makes a tiny data URI. Use PNG or WebP when the destination is an email template, a design tool, or anything that will not render SVG.',
      },
      {
        q: 'What size should a social share image be?',
        a: '1200 × 630 is the safe default: Facebook, LinkedIn and Slack all crop to roughly 1.91:1, and Twitter’s summary_large_image uses the same proportions. The presets above cover that plus the common ad and thumbnail sizes.',
      },
      {
        q: 'Is a data URI a good idea in production?',
        a: 'Only for very small images. A data URI is about a third larger than the file it carries, cannot be cached separately from the document, and blocks the HTML parser while it is read. Under a few kilobytes it saves a round trip; above roughly 30 KB it costs more than it saves.',
      },
    ],
    related: ['favicon-generator', 'resize-image', 'image-converter', 'css-gradient-generator', 'meta-tag-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'css-gradient-generator',
    title: 'CSS Gradient Generator',
    h1: 'CSS gradient generator: linear, radial and conic',
    description:
      'CSS gradient generator for linear, radial and conic gradients, with draggable colour stops, an angle dial and presets. Copy the CSS or Tailwind value.',
    keywords: [
      'css gradient maker',
      'linear gradient generator',
      'radial gradient css',
      'conic gradient',
      'gradient background css',
      'webkit gradient fallback',
      'tailwind gradient',
    ],
    category: 'generators',
    icon: 'Blend',
    faqs: [
      {
        q: 'Which way does a CSS gradient angle point?',
        a: 'In the standard syntax, 0deg points to the top of the box and the angle increases clockwise, so 90deg runs left to right and 180deg runs top to bottom. The old -webkit- syntax measured from the east and went anti-clockwise, which is why the prefixed line this tool emits uses a different number.',
      },
      {
        q: 'Do I still need the -webkit- prefix?',
        a: 'No current browser needs it. Unprefixed gradients have worked since 2013. The prefixed line is a harmless fallback for old Android WebViews and legacy email clients, and the flat colour on the first line covers anything that cannot paint a gradient.',
      },
      {
        q: 'Why does my gradient look muddy in the middle?',
        a: 'sRGB interpolation passes through a grey mid-point between complementary hues. Move the two colours closer on the hue wheel, add a mid stop in a colour you like, or use an OKLCH interpolation hint in browsers that support it.',
      },
      {
        q: 'How do I use this in Tailwind?',
        a: 'Paste the arbitrary value shown under the CSS. Tailwind accepts a full gradient inside bg-[...] if spaces are written as underscores. For a gradient used more than twice, define it as a CSS custom property and reference that.',
      },
      {
        q: 'What is a conic gradient for?',
        a: 'A conic gradient sweeps colour around a centre point. It is the simplest way to draw pie charts, progress rings, colour wheels and the “sheen” effect on a card border.',
      },
    ],
    related: ['box-shadow-generator', 'color-palette-generator', 'color-converter', 'placeholder-image-generator', 'meta-tag-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'box-shadow-generator',
    title: 'Box Shadow Generator',
    h1: 'CSS box-shadow generator',
    description:
      'Stack multiple box-shadow layers with live x, y, blur, spread, colour and inset controls, preview them on a real card, and copy the CSS or Tailwind class.',
    keywords: [
      'css box shadow',
      'multiple box shadows',
      'inset shadow css',
      'tailwind shadow class',
      'material elevation css',
      'drop shadow generator',
      'neumorphism shadow',
    ],
    category: 'generators',
    icon: 'Layers',
    faqs: [
      {
        q: 'Why do professional shadows use more than one layer?',
        a: 'Real light makes a tight contact shadow under an object and a wide, faint ambient shadow around it. One layer can only be one of those, so a single-layer shadow looks like a grey smudge. Most design systems, including Material, Tailwind and Apple’s, stack at least two.',
      },
      {
        q: 'What does spread do?',
        a: 'It grows or shrinks the shadow shape before the blur is applied. A negative spread pulls the shadow in so it shows only at the bottom. Tailwind’s md and lg shadows use this.',
      },
      {
        q: 'Should the shadow be black?',
        a: 'Rarely. Pure black at low opacity makes everything under it look grey and flat. Use a very dark, desaturated version of the background hue, such as a dark navy on a blue-grey page. The shadow then reads as depth instead of dirt.',
      },
      {
        q: 'Is box-shadow expensive to render?',
        a: 'A static shadow is cheap. Animating one is not, because the browser repaints the blur on every frame. If you need a shadow to grow on hover, animate the opacity of a second pseudo-element that already carries the larger shadow instead.',
      },
      {
        q: 'What is the difference between box-shadow and drop-shadow?',
        a: 'box-shadow always follows the border box, so a transparent PNG gets a rectangular shadow. The filter: drop-shadow() function follows the alpha channel. Use it for logos, icons and irregular shapes.',
      },
    ],
    related: ['css-gradient-generator', 'color-palette-generator', 'color-converter', 'placeholder-image-generator', 'meta-tag-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'color-palette-generator',
    title: 'Color Palette Generator',
    h1: 'Colour palette generator with contrast checking',
    description:
      'Color palette generator that builds complementary, analogous, triadic and other palettes from a base colour, with shade scales and WCAG contrast pairs.',
    keywords: [
      'color scheme generator',
      'complementary colors',
      'analogous palette',
      'triadic color scheme',
      'tailwind color palette',
      'wcag contrast checker',
      'brand color palette',
      'shade and tint generator',
    ],
    category: 'generators',
    icon: 'Palette',
    popular: true,
    faqs: [
      {
        q: 'Which harmony should I start from?',
        a: 'Analogous or monochromatic for a calm result that is hard to get wrong. Complementary when one colour must stand out against another, as with a call-to-action. Triadic and tetradic suit a mood board but are hard to control in a real interface. Mute all but one of the hues.',
      },
      {
        q: 'What does the contrast table measure?',
        a: 'The WCAG 2.1 relative luminance ratio between two colours, from 1:1 to 21:1. Body text needs 4.5:1, text above 24 px or bold above 19 px needs 3:1, and interface components such as focus rings and icons need 3:1 against their surroundings.',
      },
      {
        q: 'Why does the palette change when I press regenerate?',
        a: 'Unlocked swatches are calculated again from the harmony formula with a new random base hue and a small random variation. Lock the swatches you want to keep. A locked colour does not change, so you can fix a brand colour and shuffle everything around it.',
      },
      {
        q: 'How is the shade scale calculated?',
        a: 'Each step keeps the hue and saturation and moves to a fixed lightness, from 96% for step 50 down to 15% for step 900. Tailwind and most design systems use the same approach. The steps stay recognisably the same colour and land at predictable contrast levels.',
      },
      {
        q: 'Can I export straight into my project?',
        a: 'Yes. The export tab gives CSS custom properties, a Tailwind colour object for both v3 config and v4 @theme, and JSON with the hex, RGB, HSL and contrast values for every swatch.',
      },
    ],
    related: ['color-converter', 'css-gradient-generator', 'box-shadow-generator', 'placeholder-image-generator', 'favicon-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'meta-tag-generator',
    title: 'Meta Tag Generator',
    h1: 'Meta tag generator with Google and social previews',
    description:
      'Meta tag generator for title, description, canonical, robots, Open Graph and Twitter tags, with search and social previews and pixel-width warnings.',
    keywords: [
      'open graph generator',
      'twitter card generator',
      'seo meta tags',
      'meta description length',
      'serp preview tool',
      'canonical tag generator',
      'robots meta tag',
      'og image tags',
    ],
    category: 'generators',
    icon: 'Tags',
    faqs: [
      {
        q: 'How long should a title and description be?',
        a: 'Google truncates by pixel width: about 600 px for a desktop title and 920 px across two snippet lines. For average text, that is near 60 and 155 characters. A title with many capitals or wide letters is cut sooner, so this tool measures the real rendered width.',
      },
      {
        q: 'Does Google use my meta description as the snippet?',
        a: 'Only about two-thirds of the time. When the query matches text elsewhere on the page better, Google rewrites the snippet from that text. A good description still matters because it controls the snippet for brand and exact-match queries, which convert best.',
      },
      {
        q: 'Do I need both Open Graph and Twitter tags?',
        a: 'Open Graph is read by Facebook, LinkedIn, Slack, Discord, WhatsApp and, as a fallback, by X. You only need the twitter: tags when the card should differ from the Open Graph version, or when you want the large-image layout and the site or creator attribution.',
      },
      {
        q: 'What size should the share image be?',
        a: '1200 × 630 pixels, under 5 MB, served over HTTPS from an absolute URL. Relative paths are ignored by most crawlers. Add og:image:alt as well. Several platforms show it, and it is the only accessible description a shared card gets.',
      },
      {
        q: 'Are meta keywords worth adding?',
        a: 'No. Google has ignored the keywords tag since 2009 and Bing treats it as a spam signal. This generator leaves it out.',
      },
    ],
    related: ['favicon-generator', 'placeholder-image-generator', 'slug-generator', 'html-entity-encoder', 'color-palette-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'signature-generator',
    title: 'Signature Generator',
    h1: 'Draw your signature and download it with a transparent background',
    description:
      'Signature generator: draw your signature with a mouse, finger or stylus, then download a transparent PNG or an SVG. Stylus pressure sets the line width.',
    keywords: [
      'draw signature online',
      'transparent signature png',
      'signature svg',
      'electronic signature maker',
      'handwritten signature generator',
      'signature for pdf',
      'e sign image',
    ],
    category: 'generators',
    icon: 'Signature',
    faqs: [
      {
        q: 'Is a signature drawn here legally binding?',
        a: 'An image of a signature is not, by itself, a legally binding e-signature. Under eIDAS in the EU and the ESIGN Act in the US what matters is intent, consent and an audit trail linking the signature to the signer. For informal documents, an image is normally accepted. For important contracts, use a service that records that evidence.',
      },
      {
        q: 'Where does my signature go?',
        a: 'Nowhere. The strokes are coordinates in this browser tab, and the tab draws them into the file you download. There is no upload, server or storage. When you close the tab, the signature is gone.',
      },
      {
        q: 'PNG or SVG?',
        a: 'SVG keeps the signature as vector paths, so it stays sharp at any size and is only a few kilobytes. Use it on a web page or in an email footer. Use the transparent PNG for PDF form fields, Word documents and anything that does not accept SVG.',
      },
      {
        q: 'Why does the stroke get thinner when I move quickly?',
        a: 'Real ink thins as the pen speeds up, so the tool varies the width with drawing speed. With a stylus that reports pressure, the width also follows the pressure. Turn the option off in the pen panel for a uniform line.',
      },
      {
        q: 'How do I add this to a PDF?',
        a: 'Download the transparent PNG, then place it as an image in a PDF editor over the signature line. Trimming is on by default, so the file has no wide empty margin when you position it.',
      },
    ],
    related: ['vcard-qr-code-generator', 'watermark-pdf', 'merge-pdf', 'png-to-jpg', 'favicon-generator'],
    updated: '2026-11-01',
  },
  {
    slug: 'random-number-generator',
    title: 'Random Number Generator',
    h1: 'Random number generator',
    description:
      'Random number generator for any range, with or without repeats, as whole numbers or decimals. Has dice and coin modes and uses crypto.getRandomValues.',
    keywords: [
      'random number picker',
      'number generator 1-100',
      'lottery number generator',
      'random integer',
      'no repeat random numbers',
      'dice roller',
      'coin flip',
      'crypto random',
    ],
    category: 'generators',
    icon: 'Dices',
    popular: true,
    faqs: [
      {
        q: 'Is this really random?',
        a: 'It draws from crypto.getRandomValues, the browser’s cryptographically secure generator, which is seeded from operating-system entropy. Encryption keys use the same source. Math.random() is a fast pseudo-random algorithm with a predictable internal state, and is much weaker.',
      },
      {
        q: 'Why does the range matter for fairness?',
        a: 'Mapping a 32-bit random value onto a range with the modulo operator makes low values slightly more likely whenever the range does not divide evenly. This tool rejects and redraws the values in that unbalanced tail, so every number in your range is exactly as likely as every other.',
      },
      {
        q: 'What does “no repeats” do?',
        a: 'It draws without replacement, like pulling raffle tickets out of a hat. With repeats allowed, every draw is independent, which is correct for dice, simulations and anything statistical.',
      },
      {
        q: 'Can I use this for a prize draw?',
        a: 'Yes. For a draw with legal weight, record the range, the count and the winning numbers, and make a screen recording of the draw. Disputes are rarely about the generator itself.',
      },
      {
        q: 'Do the numbers get sent anywhere?',
        a: 'No. Generation happens in this tab, there is no server call, and nothing is logged. That also means the results cannot be recovered once you leave the page, so download or copy anything you need to keep.',
      },
    ],
    related: ['dice-roller', 'coin-flip', 'random-picker', 'password-generator', 'uuid-generator'],
    updated: '2026-11-01',
  },
]
