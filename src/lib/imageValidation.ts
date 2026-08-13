// BUG-075: profile photo uploads only checked the <input accept="image/*"> attribute and the
// browser-reported file.type, both of which a renamed file extension can spoof (e.g. a .txt file
// renamed to .jpg) — the bogus file got uploaded and stored as if it were a real image, then
// failed to render everywhere the avatar is shown. Decoding the file as an image is the only check
// a renamed extension can't fake.
export function isValidImageFile(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(true) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
    img.src = url
  })
}

// Avatars render between 26px and 64px, but people pick phone photos and screenshots that are
// several megabytes. Uploading the original left the "Uploading…" spinner going for many seconds
// on a normal connection, for an image the UI then draws at a fraction of the size. Downscaling in
// the browser first turns that into a sub-second upload.
const MAX_AVATAR_EDGE = 512
const AVATAR_JPEG_QUALITY = 0.85
// Below this, re-encoding costs more than it saves.
const SKIP_COMPRESSION_BELOW_BYTES = 200_000

export interface PreparedImage {
  blob: Blob
  contentType: string
  extension: string
}

// Never rejects: if anything about the downscale fails, the original file is uploaded as before.
export async function prepareAvatarForUpload(file: File): Promise<PreparedImage> {
  const original: PreparedImage = {
    blob: file,
    contentType: file.type || 'application/octet-stream',
    extension: file.name.split('.').pop()?.toLowerCase() || 'jpg',
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode failed'))
      el.src = url
    })

    const longestEdge = Math.max(img.width, img.height)
    const scale = Math.min(1, MAX_AVATAR_EDGE / longestEdge)
    if (scale === 1 && file.size <= SKIP_COMPRESSION_BELOW_BYTES) return original

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', AVATAR_JPEG_QUALITY),
    )
    if (!blob || blob.size >= file.size) return original
    return { blob, contentType: 'image/jpeg', extension: 'jpg' }
  } catch {
    return original
  } finally {
    URL.revokeObjectURL(url)
  }
}
