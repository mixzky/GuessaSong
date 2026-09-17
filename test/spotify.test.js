import test from 'node:test'
import assert from 'node:assert/strict'
import { playlistIdsFrom } from '../src/spotify.js'

test('extracts multiple Spotify playlist URLs and IDs', () => {
  assert.deepEqual(
    playlistIdsFrom(`
      https://open.spotify.com/playlist/5ua0AQfdNpRmbKRC5Z2ANc?si=example
      37i9dQZF1DXcBWIGoYBM5M
    `),
    ['5ua0AQfdNpRmbKRC5Z2ANc', '37i9dQZF1DXcBWIGoYBM5M'],
  )
})

test('removes duplicate playlist entries', () => {
  assert.deepEqual(
    playlistIdsFrom('37i9dQZF1DXcBWIGoYBM5M, 37i9dQZF1DXcBWIGoYBM5M'),
    ['37i9dQZF1DXcBWIGoYBM5M'],
  )
})
