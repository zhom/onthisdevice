import ImageConverter from './_Converter'

export default function JpgToPng() {
  return (
    <ImageConverter
      accept=".jpg,.jpeg,.jfif,.pjpeg,image/jpeg"
      fixedTarget="png"
      dropTitle="Drop JPG files here"
      dropHint="or click to browse. Every pixel is copied into a lossless PNG."
      zipName="jpg-to-png"
    />
  )
}
