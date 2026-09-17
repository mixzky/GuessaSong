import test from 'node:test'
import assert from 'node:assert/strict'
import { selectPlaylistTracks, trackKey } from '../src/selection.js'

const tracks = (...ids) => ids.map((id) => ({ id, title: `Song ${id}`, artist: 'Artist' }))

test('never duplicates a track that appears in overlapping playlists', () => {
  const selected = selectPlaylistTracks([
    { name: 'One', tracks: tracks('a', 'b', 'c') },
    { name: 'Two', tracks: tracks('b', 'c', 'd') },
  ], 3, [], () => .5)
  assert.equal(new Set(selected.map(trackKey)).size, selected.length)
})

test('deduplicates the same song even when Spotify gives it different track IDs', () => {
  const selected = selectPlaylistTracks([{
    name: 'One',
    tracks: [
      { id: 'album-id', title: 'Same Song', artist: 'The Artist' },
      { id: 'single-id', title: 'Same Song', artist: 'The Artist' },
      { id: 'other-id', title: 'Another Song', artist: 'The Artist' },
    ],
  }], 3, [], () => .5)
  assert.equal(selected.length, 2)
  assert.equal(new Set(selected.map(trackKey)).size, 2)
})

test('avoids the previous game before reusing songs', () => {
  const playlist = { name: 'One', tracks: tracks('a', 'b', 'c', 'd', 'e', 'f') }
  const previousKeys = tracks('a', 'b', 'c').map(trackKey)
  const expectedKeys = tracks('d', 'e', 'f').map(trackKey)
  const selected = selectPlaylistTracks([playlist], 3, previousKeys, () => .5)
  assert.deepEqual(new Set(selected.map(trackKey)), new Set(expectedKeys))
})

test('reuses recent songs only when the playlist has no fresh alternatives', () => {
  const recentTracks = tracks('a', 'b')
  const selected = selectPlaylistTracks([{ name: 'One', tracks: recentTracks }], 2, recentTracks.map(trackKey), () => .5)
  assert.equal(selected.length, 2)
  assert.equal(new Set(selected.map(trackKey)).size, 2)
})
