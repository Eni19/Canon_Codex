export type ParsedYoutubeLink =
  | { kind: 'video'; videoId: string }
  | { kind: 'playlist'; playlistId: string }

const VIDEO_ID = /^[\w-]{11}$/
const PLAYLIST_ID = /^[\w-]{10,64}$/
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])

/**
 * Understands the usual YouTube link shapes. A `watch?v=…&list=…` link is treated as the single
 * video; only `/playlist?list=…` (or a watch link with no `v`) imports a whole playlist.
 */
export function parseYoutubeUrl(input: string): ParsedYoutubeLink | null {
  const text = input.trim()
  if (!text) return null
  let url: URL
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] ?? ''
    return VIDEO_ID.test(id) ? { kind: 'video', videoId: id } : null
  }
  if (!YOUTUBE_HOSTS.has(host)) return null

  const [first, second] = url.pathname.split('/').filter(Boolean)
  const videoParam = url.searchParams.get('v')
  const listParam = url.searchParams.get('list')

  if (first === 'playlist') return listParam && PLAYLIST_ID.test(listParam) ? { kind: 'playlist', playlistId: listParam } : null
  if (first === 'watch') {
    if (videoParam && VIDEO_ID.test(videoParam)) return { kind: 'video', videoId: videoParam }
    return listParam && PLAYLIST_ID.test(listParam) ? { kind: 'playlist', playlistId: listParam } : null
  }
  if ((first === 'shorts' || first === 'embed' || first === 'live' || first === 'v') && second && VIDEO_ID.test(second)) return { kind: 'video', videoId: second }
  return null
}

/** Splits pasted text (one link per line, or separated by spaces/commas) and parses each piece. */
export function parseYoutubeLinks(text: string): { parsed: ParsedYoutubeLink[]; invalid: string[] } {
  const parsed: ParsedYoutubeLink[] = []
  const invalid: string[] = []
  for (const piece of text.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)) {
    const link = parseYoutubeUrl(piece)
    if (link) parsed.push(link)
    else invalid.push(piece)
  }
  return { parsed, invalid }
}

export function youtubeThumbnailUrl(videoId: string, quality: 'mq' | 'hq' = 'mq'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}default.jpg`
}

export function isValidVideoId(value: string): boolean {
  return VIDEO_ID.test(value)
}
