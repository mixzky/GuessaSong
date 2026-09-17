export function trackKey(track) {
  const normalizeIdentity = (value) => (value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
  const title = normalizeIdentity(track.title)
  const artist = normalizeIdentity(track.artist)
  return title && artist ? `${title}\u0000${artist}` : track.id || track.uri || title
}

export function shuffle(items, random = Math.random) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

// Select a fresh random set for every game. Tracks are deduplicated globally,
// including when the same song appears in more than one source playlist. When
// possible, songs from the immediately previous game are held back until all
// unseen candidates have been considered.
export function selectPlaylistTracks(playlists, count, previousTrackKeys = [], random = Math.random) {
  const previous = new Set(previousTrackKeys)
  const selectedKeys = new Set()
  const selected = []

  for (const sourcePlaylist of shuffle(playlists, random)) {
    const uniqueTracks = [...new Map(
      sourcePlaylist.tracks.map((track) => [trackKey(track), track]),
    ).values()]
    const fresh = shuffle(uniqueTracks.filter((track) => !previous.has(trackKey(track))), random)
    const recent = shuffle(uniqueTracks.filter((track) => previous.has(trackKey(track))), random)
    const candidates = [...fresh, ...recent]
    let added = 0

    for (const track of candidates) {
      const key = trackKey(track)
      if (selectedKeys.has(key)) continue
      selectedKeys.add(key)
      selected.push({ ...track, playlistName: sourcePlaylist.name })
      added += 1
      if (added >= count) break
    }
  }

  return shuffle(selected, random)
}
