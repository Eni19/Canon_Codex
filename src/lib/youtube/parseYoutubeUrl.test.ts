import { describe, expect, it } from 'vitest'
import { parseYoutubeLinks, parseYoutubeUrl } from './parseYoutubeUrl'

describe('parseYoutubeUrl', () => {
  it('reads the common video link shapes', () => {
    const video = { kind: 'video', videoId: 'jNQXAC9IVRw' }
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toEqual(video)
    expect(parseYoutubeUrl('youtube.com/watch?v=jNQXAC9IVRw&t=12s')).toEqual(video)
    expect(parseYoutubeUrl('https://youtu.be/jNQXAC9IVRw?si=abc')).toEqual(video)
    expect(parseYoutubeUrl('https://music.youtube.com/watch?v=jNQXAC9IVRw')).toEqual(video)
    expect(parseYoutubeUrl('https://www.youtube.com/shorts/jNQXAC9IVRw')).toEqual(video)
    expect(parseYoutubeUrl('https://www.youtube.com/embed/jNQXAC9IVRw')).toEqual(video)
  })

  it('imports a whole playlist only from a playlist link', () => {
    expect(parseYoutubeUrl('https://www.youtube.com/playlist?list=PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl')).toEqual({ kind: 'playlist', playlistId: 'PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl' })
    expect(parseYoutubeUrl('https://www.youtube.com/watch?list=PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl')).toEqual({ kind: 'playlist', playlistId: 'PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl' })
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl')).toEqual({ kind: 'video', videoId: 'jNQXAC9IVRw' })
  })

  it('rejects anything that is not a YouTube link', () => {
    expect(parseYoutubeUrl('')).toBeNull()
    expect(parseYoutubeUrl('https://example.com/watch?v=jNQXAC9IVRw')).toBeNull()
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseYoutubeUrl('not a link')).toBeNull()
  })
})

describe('parseYoutubeLinks', () => {
  it('splits pasted text and reports the pieces it could not read', () => {
    const { parsed, invalid } = parseYoutubeLinks('https://youtu.be/jNQXAC9IVRw\nhttps://www.youtube.com/playlist?list=PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl\nlixo')
    expect(parsed).toHaveLength(2)
    expect(invalid).toEqual(['lixo'])
  })
})
