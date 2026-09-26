import 'server-only'

export interface YoutubeVideoInfo {
  videoId: string
  title: string
  author?: string
}

/**
 * Looks up a video title through YouTube's public oEmbed endpoint (no API key). It answers 401/404
 * for private, deleted or not-embeddable videos, which are exactly the ones the site cannot play,
 * so a `null` result means "skip this track".
 */
export async function fetchYoutubeVideoInfo(videoId: string): Promise<YoutubeVideoInfo | null> {
  try {
    const target = `https://www.youtube.com/watch?v=${videoId}`
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!response.ok) return null
    const data = (await response.json()) as { title?: unknown; author_name?: unknown }
    if (typeof data.title !== 'string' || !data.title.trim()) return null
    return { videoId, title: data.title.trim(), author: typeof data.author_name === 'string' ? data.author_name.trim() || undefined : undefined }
  } catch {
    return null
  }
}

/** Fetches info for many videos with a small concurrency limit, keeping the input order. */
export async function fetchYoutubeVideoInfos(videoIds: string[], concurrency = 6): Promise<Array<YoutubeVideoInfo | null>> {
  const results: Array<YoutubeVideoInfo | null> = new Array(videoIds.length).fill(null)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, videoIds.length) }, async () => {
    while (cursor < videoIds.length) {
      const index = cursor++
      results[index] = await fetchYoutubeVideoInfo(videoIds[index])
    }
  }))
  return results
}
