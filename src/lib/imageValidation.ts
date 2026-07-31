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
