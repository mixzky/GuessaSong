import { extractSongTitle } from './matching.js'

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API_URL = 'https://api.spotify.com/v1'
const STORAGE_KEY = 'needle-drop-auth'

const redirectUri = () => `${window.location.origin}${window.location.pathname}`

function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('')
}

async function sha256(value) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
}

function base64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

export async function beginSpotifyLogin(clientId, playlistUrl, rounds) {
  const verifier = randomString()
  const challenge = base64Url(await sha256(verifier))
  sessionStorage.setItem('needle-drop-verifier', verifier)
  sessionStorage.setItem('needle-drop-client-id', clientId)
  sessionStorage.setItem('needle-drop-playlist', playlistUrl)
  sessionStorage.setItem('needle-drop-rounds', String(rounds))

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: 'streaming user-read-email user-read-private playlist-read-private user-modify-playback-state',
  })
  window.location.assign(`${AUTH_URL}?${params}`)
}

export async function finishSpotifyLogin() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null

  const verifier = sessionStorage.getItem('needle-drop-verifier')
  const clientId = sessionStorage.getItem('needle-drop-client-id')
  if (!verifier || !clientId) throw new Error('The Spotify sign-in session expired. Please try again.')

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new Error('Spotify sign-in could not be completed.')
  const token = await response.json()
  const auth = {
    clientId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  window.history.replaceState({}, '', redirectUri())
  return auth
}

export async function refreshAccessToken(auth) {
  if (!auth?.refreshToken) return null
  if (auth.expiresAt > Date.now() + 60_000) return auth
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: auth.clientId,
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
    }),
  })
  if (!response.ok) return null
  const token = await response.json()
  const next = {
    ...auth,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function playlistIdFrom(value) {
  const match = value.trim().match(/(?:playlist[/:])([a-zA-Z0-9]+)/)
  return match?.[1] || (value.trim().match(/^[a-zA-Z0-9]{15,}$/)?.[0] ?? null)
}

export function playlistIdsFrom(value) {
  return [...new Set(
    value
      .split(/[\s,]+/)
      .map((item) => playlistIdFrom(item))
      .filter(Boolean),
  )]
}

async function spotifyFetch(path, token, options = {}) {
  const response = await fetch(path.startsWith('http') ? path : `${API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    const message = response.status === 403
      ? 'Spotify only allows Development Mode apps to read playlists you own or collaborate on.'
      : `Spotify returned ${response.status}. Please reconnect and try again.`
    throw new Error(message)
  }
  return response.status === 204 ? null : response.json()
}

export async function getPlaylist(playlistId, token) {
  const [playlist, firstPage] = await Promise.all([
    spotifyFetch(`/playlists/${playlistId}`, token),
    spotifyFetch(`/playlists/${playlistId}/items?limit=50`, token),
  ])
  const items = [...firstPage.items]
  let next = firstPage.next
  while (next && items.length < 300) {
    const page = await spotifyFetch(next, token)
    items.push(...page.items)
    next = page.next
  }
  const tracks = items
    .map((entry) => entry.item || entry.track)
    .filter((track) => track?.type === 'track' && track.uri && !track.is_local)
    .map((track) => ({
      id: track.id,
      uri: track.uri,
      title: extractSongTitle(track.name),
      artist: track.artists?.map((artist) => artist.name).join(', ') || 'Unknown artist',
      album: track.album?.name || '',
      year: track.album?.release_date?.slice(0, 4) || '',
      art: track.album?.images?.[0]?.url || '',
      duration: track.duration_ms,
      spotifyUrl: track.external_urls?.spotify,
    }))
  return { name: playlist.name, owner: playlist.owner?.display_name, art: playlist.images?.[0]?.url, tracks }
}

let sdkPromise
export function loadSpotifySdk() {
  if (window.Spotify) return Promise.resolve(window.Spotify)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify)
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.onerror = () => reject(new Error('The Spotify player could not be loaded.'))
    document.body.appendChild(script)
  })
  return sdkPromise
}

export async function createSpotifyPlayer(getToken, volume = 0.75) {
  const Spotify = await loadSpotifySdk()
  return new Promise((resolve, reject) => {
    const player = new Spotify.Player({ name: 'Guess a Song', getOAuthToken: async (cb) => cb(await getToken()), volume })
    player.addListener('ready', ({ device_id: deviceId }) => resolve({ player, deviceId }))
    player.addListener('initialization_error', ({ message }) => reject(new Error(message)))
    player.addListener('authentication_error', ({ message }) => reject(new Error(message)))
    player.addListener('account_error', () => reject(new Error('Spotify Premium is required for in-browser playback.')))
    player.connect().then((connected) => !connected && reject(new Error('Spotify player did not connect.')))
  })
}

export async function playTrack(token, deviceId, track, positionMs) {
  await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, token, {
    method: 'PUT',
    body: JSON.stringify({ uris: [track.uri], position_ms: positionMs }),
  })
}
