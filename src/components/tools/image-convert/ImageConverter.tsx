import ImageConverter from './_Converter'

export default function UniversalImageConverter() {
  return (
    <ImageConverter
      accept=".jpg,.jpeg,.jfif,.png,.webp,.avif,.gif,.bmp,.svg,image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/svg+xml"
      targetChoices={['jpeg', 'png', 'webp', 'avif']}
      dropTitle="Drop any images here"
      dropHint="JPG, PNG, WebP, AVIF, GIF, BMP and SVG. The format is detected from the file itself."
      zipName="converted-images"
    />
  )
}
