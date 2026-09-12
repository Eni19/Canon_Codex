const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

const EXTENSION_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXTENSION).map(([mime, ext]) => [ext, mime]),
)
EXTENSION_TO_MIME.jpeg = 'image/jpeg'

export function extensionForMimeType(mimeType: string): string | null {
  return MIME_TO_EXTENSION[mimeType] ?? null
}

export function mimeTypeForExtension(extension: string): string | null {
  return EXTENSION_TO_MIME[extension.toLowerCase().replace(/^\./, '')] ?? null
}

export function isSupportedImageMimeType(mimeType: string): boolean {
  return mimeType in MIME_TO_EXTENSION
}
