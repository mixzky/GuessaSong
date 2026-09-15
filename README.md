# Guess a Song

A browser music quiz: connect Spotify, choose one of your playlists, hear a random 15-second section, and type the song title.

## Product plan

The MVP is deliberately one-player and fast:

1. Paste a Spotify playlist link and choose 5, 10, or 15 rounds.
2. Hear one 15-second clip per round with the track metadata hidden.
3. Type the song title. Matching ignores punctuation, accents, version/remaster labels, and small spelling mistakes.
4. Earn 100 points for every correct answer, then review the full setlist at the end.

An audio-synth demo is built in, so the full game can be tested without Spotify credentials.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Connect Spotify

Spotify playback requires a Premium account and a Spotify Developer app.

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add the exact URL shown in Guess a Song's settings dialog as an allowed Redirect URI (normally `http://127.0.0.1:5173/` or `http://localhost:5173/`).
3. Copy the app's Client ID into Guess a Song settings. Do not use or expose the Client Secret.
4. Paste a playlist you own or collaborate on and connect.

Spotify's 2026 Development Mode rules limit playlist item access to playlists owned by or shared collaboratively with the signed-in user. Spotify Web Playback SDK also requires Premium. The app uses Authorization Code with PKCE and keeps tokens in browser storage; a production deployment should add a strict Content Security Policy and review Spotify's Developer Terms.

## Stack

- React + Vite
- Spotify Web API and Web Playback SDK
- OAuth Authorization Code with PKCE
- No backend required for the MVP
