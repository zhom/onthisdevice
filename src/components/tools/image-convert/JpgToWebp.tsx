import ImageConverter from './_Converter'

export default function JpgToWebp() {
  return (
    <ImageConverter
      accept=".jpg,.jpeg,.jfif,.pjpeg,image/jpeg"
      fixedTarget="webp"
      defaultQuality={80}
      dropTitle="Drop JPG files here"
      dropHint="or click to browse. The libwebp encoder does the conversion."
      zipName="jpg-to-webp"
    />
  )
}
