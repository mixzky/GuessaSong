import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleHelp, ExternalLink, Headphones, History, Info, Link2, LoaderCircle, LogOut, Maximize2, Moon, Music2, Pause, Play, Plus, RotateCcw, Settings2, SkipForward, Sparkles, Sun, Trophy, Volume2, X } from 'lucide-react'
import { DEMO_PLAYLIST, pauseDemo, playDemo, resumeDemo, setDemoVolume, stopDemo } from './demo.js'
import { beginSpotifyLogin, clearAuth, createSpotifyPlayer, finishSpotifyLogin, getPlaylist, getStoredAuth, playlistIdsFrom, playTrack, refreshAccessToken } from './spotify.js'
import { isCorrectGuess } from './matching.js'
import { pointsForGuess, pointsForIntroGuess } from './scoring.js'
import { selectPlaylistTracks, trackKey } from './selection.js'
import { streakMilestone, summarizeSession, trailingStreak } from './session.js'

const GAME_MODES = [
  { id: 'title', label: 'Song title', description: 'Name the track' },
  { id: 'artist', label: 'Artist', description: 'Name the performer' },
  { id: 'both', label: 'Both', description: 'Title + artist' },
  { id: 'intro', label: 'Intro rush', description: 'Only five seconds' },
]
const INTRO_DURATIONS = [5, 10, 15, 30]

function storedPlaylistNames() {
  try { return JSON.parse(sessionStorage.getItem('guess-a-song-playlist-names') || '{}') }
  catch { return {} }
}

function VinylMark() {
  return <span className="brand-mark"><span /></span>
}

function Header({ auth, theme, onToggleTheme, onHome, onSettings, onUpdates, onDisconnect }) {
  return (
    <header className="site-header">
      <button className="brand" onClick={onHome} aria-label="Guess a Song home">
        <VinylMark />
        <span>GUESS A <b>SONG</b><small>MUSIC QUIZ / 音楽クイズ</small></span>
      </button>
      <nav>
        <button className="text-button updates-button" onClick={onUpdates} title="Update logs"><History size={16} /> <span>Updates</span></button>
        <button className="icon-button theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="icon-button" onClick={onSettings} aria-label="Spotify settings"><Settings2 size={19} /></button>
        {auth && <button className="text-button" onClick={onDisconnect}><LogOut size={16} /> Disconnect</button>}
      </nav>
    </header>
  )
}

function PlaylistBuilder({ value, onChange, names, onNameChange, onRemoveName }) {
  const [draft, setDraft] = useState('')
  const [inputError, setInputError] = useState('')
  const ids = useMemo(() => playlistIdsFrom(value), [value])

  const addPlaylists = () => {
    const incoming = playlistIdsFrom(draft)
    if (!incoming.length) {
      setInputError('Paste a Spotify playlist link or ID.')
      return
    }
    const combined = [...new Set([...ids, ...incoming])]
    incoming.forEach((id) => {
      if (!names[id]) onNameChange(id, `Playlist ${combined.indexOf(id) + 1}`)
    })
    onChange(combined.map((id) => `https://open.spotify.com/playlist/${id}`).join('\n'))
    setDraft('')
    setInputError('')
  }

  const removePlaylist = (id) => {
    onChange(ids.filter((item) => item !== id).map((item) => `https://open.spotify.com/playlist/${item}`).join('\n'))
    onRemoveName(id)
  }

  const clearPlaylists = () => {
    ids.forEach(onRemoveName)
    onChange('')
  }

  return (
    <div className="field-group playlist-builder">
      <div className="field-label-row">
        <label htmlFor="playlist">Spotify playlists</label>
        {!!ids.length && <button type="button" onClick={clearPlaylists}>Clear all</button>}
      </div>
      <div className="playlist-add-row">
        <div className="input-shell playlist-input-shell">
          <Link2 size={19} />
          <input
            id="playlist"
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setInputError('') }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addPlaylists() } }}
            placeholder="Paste a Spotify playlist link or ID"
          />
        </div>
        <button type="button" className="add-playlist-button" onClick={addPlaylists} disabled={!draft.trim()}><Plus size={18} /> Add</button>
      </div>
      {inputError && <span className="playlist-input-error">{inputError}</span>}
      {!!ids.length && (
        <div className="playlist-chips" aria-label="Added playlists">
          {ids.map((id, index) => (
            <div className="playlist-chip" key={id}>
              <span className="playlist-chip-index">{String(index + 1).padStart(2, '0')}</span>
              <Music2 size={16} />
              <div className="playlist-chip-copy">
                <input value={names[id] ?? `Playlist ${index + 1}`} onChange={(event) => onNameChange(id, event.target.value)} aria-label={`Playlist ${index + 1} name`} maxLength={40} />
                <small>Spotify · …{id.slice(-8)}</small>
              </div>
              <button type="button" onClick={() => removePlaylist(id)} aria-label={`Remove playlist ${index + 1}`}><X size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <span className="field-note">Paste a link and press Enter or Add. Add several playlists to create a mixed quiz.</span>
    </div>
  )
}

function Setup({ auth, playlistUrl, setPlaylistUrl, playlistNames, onPlaylistNameChange, onRemovePlaylistName, rounds, setRounds, gameMode, setGameMode, hintPenalty, setHintPenalty, onDemo, onSpotify, busy, error, onSettings }) {
  const playlistCount = playlistIdsFrom(playlistUrl).length
  return (
    <main className="setup-page">
      <section className="hero">
        <div className="eyebrow"><span /> Welcome to the music club</div>
        <h1>A little music.<br /><em>A new challenge.</em></h1>
        <p className="hero-copy">Your favorite playlist. {gameMode === 'intro' ? 'Five' : 'Fifteen'} seconds to recognize it.<br />Listen, name the song, and make every round count.</p>

        <div className="setup-card">
          <div className="panel-heading"><span>01 / SESSION SETUP</span><Headphones size={19} /></div>
          <PlaylistBuilder value={playlistUrl} onChange={setPlaylistUrl} names={playlistNames} onNameChange={onPlaylistNameChange} onRemoveName={onRemovePlaylistName} />

          <div className="round-picker">
            <span>Songs per playlist</span>
            <div className="segmented">
              {[5, 10, 15].map((count) => <button key={count} aria-pressed={rounds === count} className={rounds === count ? 'active' : ''} onClick={() => setRounds(count)}>{count}</button>)}
            </div>
          </div>
          <div className="game-option">
            <span>Game mode</span>
            <div className="mode-picker">
              {GAME_MODES.map((mode) => <button type="button" key={mode.id} aria-pressed={gameMode === mode.id} className={gameMode === mode.id ? 'active' : ''} onClick={() => setGameMode(mode.id)}><strong>{mode.label}</strong><small>{mode.description}</small></button>)}
            </div>
          </div>
          <div className="game-option compact-option">
            <span>Points lost per hint</span>
            <div className="segmented penalty-picker">
              {[10, 20, 25].map((penalty) => <button type="button" key={penalty} aria-pressed={hintPenalty === penalty} className={hintPenalty === penalty ? 'active' : ''} onClick={() => setHintPenalty(penalty)}>{penalty}</button>)}
            </div>
          </div>
          {playlistCount > 1 && <div className="playlist-total">{playlistCount} playlists × {rounds} songs = <strong>{playlistCount * rounds} rounds</strong></div>}

          {error && <div className="error-banner"><Info size={18} /> <span>{error}</span></div>}

          <button className="primary-button" disabled={busy || !playlistUrl.trim()} onClick={onSpotify}>
            {busy ? <LoaderCircle className="spin" size={20} /> : <Play size={19} fill="currentColor" />}
            {auth ? 'Play this playlist' : 'Connect Spotify & play'}
            {!busy && <ArrowRight size={19} />}
          </button>
          {!auth && <button className="client-link" onClick={onSettings}>First time? Add your Spotify Client ID</button>}
          <div className="or"><span />or<span /></div>
          <button className="secondary-button" disabled={busy} onClick={onDemo}><Sparkles size={18} /> Try the instant demo</button>
        </div>
      </section>

      <aside className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <img className="mascot" src="/assets/guess-a-song-mascot-halftone.png" alt="" />
        <div className="preview-player">
          <div className="panel-heading"><span>LISTENING SESSION</span><span>♫</span></div>
          <div className="preview-label">A familiar melody. A fresh start.</div>
          <div className="preview-timer"><strong>15</strong><span>SECONDS</span></div>
          <Waveform remaining={15} playing={false} />
          <div className="preview-bottom"><span>READY TO LISTEN</span><span className="preview-play"><Play size={22} fill="currentColor" /></span></div>
        </div>
        <span className="art-cross cross-one">+</span><span className="art-cross cross-two">+</span>
      </aside>

      <section className="how-it-works">
        <div><b>01</b><span><strong>Pick a playlist</strong>Your songs, your difficulty.</span></div>
        <div><b>02</b><span><strong>Listen for {gameMode === 'intro' ? '5' : '15'} sec</strong>A random moment, no spoilers.</span></div>
        <div><b>03</b><span><strong>Name that tune</strong>Close spelling counts.</span></div>
      </section>
    </main>
  )
}

function SettingsModal({ initialId, onClose, onSave }) {
  const [id, setId] = useState(initialId || '')
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="modal-icon"><Settings2 /></div>
        <h2 id="settings-title">Connect your Spotify app</h2>
        <p>Guess a Song uses Spotify’s secure browser sign-in. Your Client ID stays in this browser; no client secret is needed.</p>
        <label htmlFor="client-id">Spotify Client ID</label>
        <input id="client-id" autoFocus value={id} onChange={(e) => setId(e.target.value.trim())} placeholder="e.g. 1a2b3c4d…" />
        <div className="redirect-box"><small>Add this Redirect URI in Spotify Dashboard</small><code>{`${window.location.origin}${window.location.pathname}`}</code></div>
        <a className="docs-link" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Open Spotify Dashboard <ExternalLink size={15} /></a>
        <button className="primary-button" disabled={!id} onClick={() => onSave(id)}><Check size={19} /> Save Client ID</button>
      </section>
    </div>
  )
}

function UpdateLogsModal({ onClose }) {
  const updates = [
    {
      version: 'v2.0',
      date: 'September 17, 2026',
      title: 'Co-op session highlights',
      items: ['A shared group streak now grows with every correct answer', 'Milestone celebrations at 3, 5, and 10 songs', 'End-of-session recap for hints, re-listens, clean wins, and the toughest song'],
    },
    {
      version: 'v1.9',
      date: 'September 17, 2026',
      title: 'Reliable re-listening',
      items: ['Re-listen now restarts the current excerpt and timer correctly in every game mode'],
    },
    {
      version: 'v1.8',
      date: 'September 17, 2026',
      title: 'Mascot hint reactions',
      items: ['The anime mascot now pops in with a short animated message whenever a hint is used'],
    },
    {
      version: 'v1.7',
      date: 'September 17, 2026',
      title: 'Album cover magnifier',
      items: ['Click a revealed album-cover hint to view the artwork at a larger size'],
    },
    {
      version: 'v1.6',
      date: 'September 17, 2026',
      title: 'Intro Rush ladder',
      items: ['Extend clips from 5 to 10, 15, or 30 seconds', 'Maximum score drops by 25 points at every extension'],
    },
    {
      version: 'v1.5',
      date: 'September 17, 2026',
      title: 'A smoother game entrance',
      items: ['Manga countdown now plays before entering the game', 'Editable display names for every added playlist'],
    },
    {
      version: 'v1.4',
      date: 'September 17, 2026',
      title: 'More ways to play',
      items: ['Song Title, Artist, Both, and five-second Intro Rush modes', 'Three-step hints with configurable point penalties', 'One manga-style countdown at the start of each game'],
    },
    {
      version: 'v1.3',
      date: 'September 17, 2026',
      title: 'Fairer playlists',
      items: ['Global duplicate-song protection', 'Fresh songs prioritized when playing again', 'Cleaner titles for remixes, features, soundtrack labels, and production credits'],
    },
    {
      version: 'v1.2',
      date: 'September 16, 2026',
      title: 'New visual identity',
      items: ['Light and dark themes', 'Halftone music-club mascot', 'Animated stars, orbital motion, and sharper cover hints'],
    },
  ]
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal update-log-modal" role="dialog" aria-modal="true" aria-labelledby="updates-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="modal-icon"><History /></div>
        <span className="update-log-kicker">WHAT'S NEW</span>
        <h2 id="updates-title">Update logs</h2>
        <p>Everything recently added to Guess a Song.</p>
        <div className="update-log-list">
          {updates.map((update) => (
            <article key={update.version} className="update-log-entry">
              <div><strong>{update.version}</strong><time>{update.date}</time></div>
              <h3>{update.title}</h3>
              <ul>{update.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </div>
        <button className="primary-button" onClick={onClose}>Got it</button>
      </section>
    </div>
  )
}

function Waveform({ remaining, playing, duration = 15 }) {
  const bars = useMemo(() => Array.from({ length: 54 }, (_, i) => 20 + Math.abs(Math.sin(i * 1.77) * 50) + ((i * 17) % 22)), [])
  const elapsed = (duration - remaining) / duration
  return <div className={`waveform ${playing ? 'playing' : ''}`}>{bars.map((height, i) => <i key={i} className={i / bars.length < elapsed ? 'heard' : ''} style={{ height: `${height}%`, animationDelay: `${(i % 9) * -0.08}s` }} />)}</div>
}

function GameIntro({ count, playlistName }) {
  return (
    <main className="game-intro-page" aria-live="assertive">
      <div className="entry-countdown">
        <span key={count}>{count}</span>
        <small>GET READY</small>
        <p>{playlistName}</p>
      </div>
    </main>
  )
}

function Game({ playlist, gameTracks, source, playerRef, tokenGetter, volume, setVolume, gameMode, hintPenalty, onFinish, onQuit }) {
  const [introStage, setIntroStage] = useState(0)
  const roundSeconds = gameMode === 'intro' ? INTRO_DURATIONS[introStage] : 15
  const [round, setRound] = useState(0)
  const [remaining, setRemaining] = useState(roundSeconds)
  const [guess, setGuess] = useState('')
  const [artistGuess, setArtistGuess] = useState('')
  const [phase, setPhase] = useState('ready')
  const [coverOpen, setCoverOpen] = useState(false)
  const [hintMessage, setHintMessage] = useState(null)
  const [history, setHistory] = useState([])
  const [audioError, setAudioError] = useState('')
  const [hintsUsed, setHintsUsed] = useState(0)
  const [replaysUsed, setReplaysUsed] = useState(0)
  const timerRef = useRef(null)
  const hintMessageTimerRef = useRef(null)
  const clipStartRef = useRef(null)
  const current = gameTracks[round]
  const score = history.reduce((sum, item) => sum + item.points, 0)

  const stopAudio = async () => {
    window.clearInterval(timerRef.current)
    if (source === 'demo') stopDemo()
    else await playerRef.current?.player.pause().catch(() => {})
  }

  const startCountdown = () => {
    window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => setRemaining((value) => {
      if (value <= 1) {
        window.clearInterval(timerRef.current)
        if (source === 'demo') stopDemo(); else playerRef.current?.player.pause().catch(() => {})
        setPhase('guessing')
        return 0
      }
      return value - 1
    }), 1000)
  }

  const startClip = async (duration = roundSeconds) => {
    setAudioError('')
    setPhase('playing')
    setRemaining(duration)
    try {
      if (source === 'demo') playDemo(current, volume)
      else {
        await playerRef.current.player.activateElement()
        const token = await tokenGetter()
        const latestStart = Math.max(0, current.duration - 35_000)
        if (clipStartRef.current === null) {
          clipStartRef.current = Math.min(latestStart, Math.max(15_000, Math.floor(current.duration * (0.2 + Math.random() * 0.35))))
        }
        await playTrack(token, playerRef.current.deviceId, current, clipStartRef.current)
      }
      startCountdown()
    } catch (error) {
      setAudioError(error.message)
      setPhase('ready')
    }
  }


  const pauseClip = async () => {
    window.clearInterval(timerRef.current)
    if (source === 'demo') await pauseDemo()
    else await playerRef.current?.player.pause()
    setPhase('paused')
  }

  const resumeClip = async () => {
    setAudioError('')
    try {
      if (source === 'demo') await resumeDemo()
      else await playerRef.current?.player.resume()
      setPhase('playing')
      startCountdown()
    } catch (error) {
      setAudioError(error.message)
    }
  }

  const replayClip = async () => {
    await stopAudio()
    setReplaysUsed((value) => value + 1)
    await startClip(roundSeconds)
  }

  const extendIntroClip = async () => {
    if (gameMode !== 'intro' || introStage >= INTRO_DURATIONS.length - 1) return
    const nextStage = introStage + 1
    const nextDuration = INTRO_DURATIONS[nextStage]
    await stopAudio()
    setIntroStage(nextStage)
    await startClip(nextDuration)
  }

  const changeVolume = (event) => {
    const nextVolume = Number(event.target.value)
    setVolume(nextVolume)
    localStorage.setItem('guess-a-song-volume', String(nextVolume))
    if (source === 'demo') setDemoVolume(nextVolume)
    else playerRef.current?.player.setVolume(nextVolume).catch(() => {})
  }

  useEffect(() => () => { window.clearInterval(timerRef.current); window.clearTimeout(hintMessageTimerRef.current); stopDemo(); playerRef.current?.player.pause().catch(() => {}) }, [])
  useEffect(() => {
    if (!coverOpen) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && setCoverOpen(false)
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [coverOpen])

  const submit = async (skipped = false) => {
    const missingAnswer = gameMode === 'both' ? !guess.trim() || !artistGuess.trim() : !guess.trim()
    if (phase === 'revealed' || (missingAnswer && !skipped)) return
    await stopAudio()
    const titleCorrect = isCorrectGuess(guess, current.title)
    const artistCorrect = isCorrectGuess(gameMode === 'both' ? artistGuess : guess, current.artist)
    const correct = !skipped && (gameMode === 'artist' ? artistCorrect : gameMode === 'both' ? titleCorrect && artistCorrect : titleCorrect)
    const result = skipped ? 'skipped' : correct ? 'title' : 'wrong'
    const points = gameMode === 'intro'
      ? pointsForIntroGuess(correct, introStage, hintsUsed, hintPenalty)
      : pointsForGuess(correct, hintsUsed, hintPenalty)
    const submittedGuess = gameMode === 'both' ? `${guess} / ${artistGuess}` : guess
    const streak = correct ? trailingStreak(history) + 1 : 0
    setHistory((items) => [...items, { track: current, guess: skipped ? '' : submittedGuess, correct, result, points, hintsUsed, replaysUsed, streak, introStage, clipSeconds: roundSeconds }])
    setPhase('revealed')
  }

  const next = () => {
    if (round + 1 >= gameTracks.length) return onFinish(history)
    setRound((value) => value + 1)
    setRemaining(roundSeconds)
    setGuess('')
    setArtistGuess('')
    setIntroStage(0)
    setCoverOpen(false)
    setHintsUsed(0)
    setReplaysUsed(0)
    setHintMessage(null)
    window.clearTimeout(hintMessageTimerRef.current)
    setPhase('ready')
    setAudioError('')
    clipStartRef.current = null
  }

  const lastResult = history[history.length - 1]
  const currentStreak = trailingStreak(history)
  const milestone = streakMilestone(lastResult?.streak)
  const mode = GAME_MODES.find((item) => item.id === gameMode) || GAME_MODES[0]
  const finalHintValue = gameMode === 'artist' ? current.title : current.artist
  const hintTitle = hintsUsed === 1 ? 'Album cover revealed' : hintsUsed === 2 ? (current.year ? `Released in ${current.year}` : `Album: ${current.album || 'Unknown'}`) : finalHintValue
  const hintDetail = hintsUsed === 1 ? 'The next hint reveals the release year.' : hintsUsed === 2 ? `The final hint reveals the ${gameMode === 'artist' ? 'song title' : 'artist'}.` : `${gameMode === 'artist' ? 'Song title' : 'Artist'} revealed.`
  const nextHintLabel = hintsUsed === 0 ? 'Show album cover' : hintsUsed === 1 ? 'Reveal release year' : hintsUsed === 2 ? `Reveal ${gameMode === 'artist' ? 'song title' : 'artist name'}` : 'All hints revealed'
  const introMaxPoints = Math.max(0, 100 - introStage * 25)
  const currentMaxPoints = gameMode === 'intro' ? introMaxPoints : 100
  const useHint = () => {
    if (hintsUsed >= 3) return
    const nextHint = hintsUsed + 1
    const messages = [
      'Take a close look—does this cover feel familiar? ♪',
      current.year ? `A little time travel: this one arrived in ${current.year}!` : `The album is called “${current.album || 'Mystery album'}”.`,
      gameMode === 'artist' ? `Final clue: the song is “${current.title}”!` : `Final clue: listen for ${current.artist}!`,
    ]
    setHintsUsed(nextHint)
    window.clearTimeout(hintMessageTimerRef.current)
    setHintMessage({ id: `${round}-${nextHint}-${Date.now()}`, text: messages[nextHint - 1] })
    hintMessageTimerRef.current = window.setTimeout(() => setHintMessage(null), 4200)
  }
  return (
    <main className="game-page">
      <div className="game-cosmos" aria-hidden="true">
        <i className="cosmos-orbit orbit-far" /><i className="cosmos-orbit orbit-mid" /><i className="cosmos-orbit orbit-near" />
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} style={{ '--star-x': `${(index * 37 + 11) % 97}%`, '--star-y': `${(index * 53 + 7) % 91}%`, '--star-delay': `${-(index % 7) * .73}s`, '--star-size': `${2 + (index % 3)}px` }} />
        ))}
      </div>
      <div className="game-topline">
        <button className="back-link" onClick={onQuit}><ArrowLeft size={17} /> Leave game</button>
        <div className="round-dots">{gameTracks.map((_, i) => <i key={i} className={i < round ? 'done' : i === round ? 'current' : ''} />)}</div>
        <div className="game-status"><span className={`streak-pill ${currentStreak ? 'active' : ''}`}><Sparkles size={15} /><small>STREAK</small>{currentStreak}</span><span className="score"><small>SCORE</small>{score.toLocaleString()}</span></div>
      </div>

      <section className={`game-card phase-${phase} ${milestone ? 'streak-milestone' : ''}`}>
        <div className="round-label">{mode.label.toUpperCase()} · ROUND {round + 1} <span>/ {gameTracks.length}</span></div>
        {phase !== 'revealed' ? (
          <>
            <h2>{phase === 'ready' ? 'Ready when you are' : phase === 'playing' ? (gameMode === 'artist' ? 'Name that artist' : gameMode === 'both' ? 'Name them both' : 'Name that song') : phase === 'paused' ? 'Clip paused' : 'What did you hear?'}</h2>
            <p className="game-prompt">{phase === 'ready' ? `Press play for your ${roundSeconds}-second clip.` : phase === 'playing' ? 'Type your answer while the music plays.' : phase === 'paused' ? 'Resume when you’re ready, or listen again from the start.' : 'Time’s up — take your best shot.'}</p>
            <div className="timer-row"><span className="time">0:{String(remaining).padStart(2, '0')}</span><Waveform remaining={remaining} playing={phase === 'playing'} duration={roundSeconds} /></div>
            {gameMode === 'intro' && <div className="intro-stakes"><span>{roundSeconds}-second clip</span><strong>{introMaxPoints} points max</strong></div>}
            <label className="volume-control">
              <Volume2 size={17} aria-hidden="true" />
              <span>Volume</span>
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={changeVolume} style={{ '--volume': volume }} aria-label="Playback volume" />
              <output>{Math.round(volume * 100)}%</output>
            </label>
            {audioError && <div className="error-banner compact"><Info size={17} />{audioError}</div>}
            {hintsUsed > 0 && (
              <div className="hint-card" aria-live="polite">
                <button className="hint-cover cover-magnifier" type="button" onClick={() => setCoverOpen(true)} aria-label="Enlarge album cover">
                  {current.art
                    ? <img src={current.art} alt="" />
                    : <div className="hint-demo-art" style={{ '--art-color': current.color }}><VinylMark /></div>}
                  <span className="magnifier-icon" aria-hidden="true"><Maximize2 size={15} /></span>
                </button>
                <div>
                  <span className="hint-kicker">Hint {hintsUsed} of 3</span>
                  <strong>{hintTitle}</strong>
                  <small>{hintDetail}</small>
                </div>
              </div>
            )}
            <button className="hint-button" type="button" disabled={hintsUsed >= 3} onClick={useHint}>
              <CircleHelp size={16} />
              {nextHintLabel}
              <span>{hintsUsed < 3 ? `−${hintPenalty} pts` : `${Math.max(0, currentMaxPoints - hintPenalty * 3)} pts max`}</span>
            </button>
            {phase === 'ready' ? (
              <button className="listen-button" onClick={() => startClip()}><Play size={24} fill="currentColor" /> Play clip</button>
            ) : (
              <>
                <div className="playback-controls">
                  {phase !== 'guessing' && <button type="button" onClick={phase === 'playing' ? pauseClip : resumeClip}>{phase === 'playing' ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}{phase === 'playing' ? 'Pause' : 'Resume'}</button>}
                  <button type="button" onClick={replayClip}><RotateCcw size={16} /> Re-listen</button>
                  {gameMode === 'intro' && introStage < INTRO_DURATIONS.length - 1 && <button type="button" className="extend-clip" onClick={extendIntroClip}><Plus size={16} /> Extend to {INTRO_DURATIONS[introStage + 1]}s</button>}
                </div>
                <form className={`guess-form ${gameMode === 'both' ? 'dual' : ''}`} onSubmit={(e) => { e.preventDefault(); submit() }}>
                  <div className="guess-inputs">
                    <input autoFocus value={guess} onChange={(e) => setGuess(e.target.value)} placeholder={gameMode === 'artist' ? 'Type the artist name…' : 'Type the song title…'} aria-label={gameMode === 'artist' ? 'Artist name' : 'Song title'} />
                    {gameMode === 'both' && <input value={artistGuess} onChange={(e) => setArtistGuess(e.target.value)} placeholder="Type the artist name…" aria-label="Artist name" />}
                  </div>
                  <button type="submit" disabled={!guess.trim() || (gameMode === 'both' && !artistGuess.trim())}>Guess <ArrowRight size={18} /></button>
                </form>
              </>
            )}
            <button className="skip-button" onClick={() => submit(true)}>Skip song <SkipForward size={15} /></button>
          </>
        ) : (
          <div className="reveal">
            {lastResult.correct && <div className="celebration" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--spark': i }} />)}</div>}
            <img className={`result-face ${lastResult.correct ? 'happy' : 'sad'}`} src={lastResult.correct ? '/assets/mascot-face-happy.png' : '/assets/mascot-face-sad.png'} alt={lastResult.correct ? 'Mascot celebrating the correct answer' : 'Mascot looking sad about the incorrect answer'} />
            <div className={`result-badge ${lastResult.correct ? 'correct' : 'wrong'}`}>{lastResult.correct ? <Check size={19} /> : <X size={19} />}{lastResult.correct ? 'Song nailed' : 'Not this time'}</div>
            {milestone && <div className="streak-celebration" role="status"><Sparkles aria-hidden="true" /><div><small>{milestone.label}</small><strong>{milestone.streak} SONG STREAK</strong></div></div>}
            {current.art ? <img className="album-art" src={current.art} alt={`${current.album} cover`} /> : <div className="album-art demo-art" style={{ '--art-color': current.color }}><VinylMark /><span>{current.album}</span></div>}
            <h2>{current.title}</h2>
            <p className="artist">{current.artist}</p>
            {playlist.sources.length > 1 && <p className="source-playlist">From {current.playlistName}</p>}
            {!lastResult.correct && lastResult.guess && <p className="your-guess">Your guess: <s>{lastResult.guess}</s></p>}
            {lastResult.correct && lastResult.hintsUsed > 0 && <p className="hint-cost">{lastResult.hintsUsed} hint{lastResult.hintsUsed > 1 ? 's' : ''} used · −{lastResult.hintsUsed * hintPenalty} points</p>}
            {lastResult.correct && gameMode === 'intro' && lastResult.introStage > 0 && <p className="hint-cost intro-cost">{lastResult.clipSeconds}-second clip · −{lastResult.introStage * 25} points</p>}
            <div className="points-earned">+{lastResult.points} <span>points</span></div>
            {current.spotifyUrl && <a className="spotify-attribution" href={current.spotifyUrl} target="_blank" rel="noreferrer">Listen on Spotify <ExternalLink size={14} /></a>}
            <button className="primary-button next-button" onClick={next}>{round + 1 === gameTracks.length ? 'See my results' : 'Next song'} <ArrowRight size={19} /></button>
          </div>
        )}
      </section>
      {hintMessage && (
        <div className="mascot-hint-message" key={hintMessage.id} role="status" aria-live="polite">
          <img src="/assets/guess-a-song-mascot-halftone.png" alt="" />
          <div><small>HINT CLUB</small><p>{hintMessage.text}</p></div>
        </div>
      )}
      {coverOpen && (
        <div className="cover-lightbox" role="dialog" aria-modal="true" aria-label="Album cover preview" onMouseDown={(event) => event.target === event.currentTarget && setCoverOpen(false)}>
          <div className="cover-lightbox-panel">
            <button className="cover-lightbox-close" type="button" onClick={() => setCoverOpen(false)} aria-label="Close album cover preview"><X size={20} /></button>
            {current.art
              ? <img src={current.art} alt={`${current.album || current.title} cover`} />
              : <div className="cover-lightbox-demo" style={{ '--art-color': current.color }}><VinylMark /><strong>{current.album}</strong></div>}
            <div className="cover-lightbox-caption"><strong>{current.album || 'Album artwork'}</strong><span>Cover hint</span></div>
          </div>
        </div>
      )}
      <div className="playlist-caption"><Headphones size={16} /><span>Playing from</span><strong>{playlist.name}</strong></div>
    </main>
  )
}

function Results({ history, totalRounds, playlist, onAgain, onHome }) {
  const summary = summarizeSession(history, totalRounds)
  const { correct, score, percent } = summary
  return (
    <main className="results-page">
      <section className="results-summary">
        <img className="results-mascot" src="/assets/guess-a-song-mascot-halftone.png" alt="Guess a Song halftone music club mascot" />
        <div className="trophy"><Trophy /></div>
        <div className="eyebrow"><span /> Set complete</div>
        <h1>{summary.rating}</h1>
        <p>{playlist.name} was a team effort.</p>
        <div className="big-score"><strong>{score.toLocaleString()}</strong><span>POINTS</span></div>
        <div className="stats"><div><strong>{correct}/{totalRounds}</strong><span>Scored</span></div><div><strong>{percent}%</strong><span>Points won</span></div><div><strong>{summary.bestStreak}</strong><span>Best streak</span></div></div>
        <div className="recap-grid">
          <div><Sparkles size={16} /><strong>{summary.cleanWins}</strong><span>Clean wins</span></div>
          <div><CircleHelp size={16} /><strong>{summary.totalHints}</strong><span>Hints used</span></div>
          <div><RotateCcw size={16} /><strong>{summary.totalRelistens}</strong><span>Re-listens</span></div>
          <div><Plus size={16} /><strong>{summary.totalExtensions}</strong><span>Clip extensions</span></div>
        </div>
        {summary.hardestRound && <div className="hardest-song"><span>TOUGHEST SONG</span><strong>{summary.hardestRound.track.title}</strong><small>{summary.hardestRound.track.artist}</small></div>}
        <div className="results-actions"><button className="primary-button" onClick={onAgain}><RotateCcw size={18} /> Play again</button><button className="secondary-button" onClick={onHome}>Change playlist</button></div>
      </section>
      <section className="track-list">
        <div className="list-heading"><h2>Your setlist</h2><span>{correct} of {totalRounds} scored</span></div>
        {history.map((item, i) => (
          <div className="track-row" key={`${item.track.id}-${i}`}>
            <span className={`track-status ${item.correct ? 'correct' : 'wrong'}`}>{item.correct ? <Check size={17} /> : <X size={17} />}</span>
            <span className="track-number">{String(i + 1).padStart(2, '0')}</span>
            <div><strong>{item.track.title}</strong><span>{item.track.artist}{playlist.sources.length > 1 ? ` · ${item.track.playlistName}` : ''}</span></div>
            <b>{item.streak >= 3 && <small className="track-streak">{item.streak} streak</small>}+{item.points}</b>
          </div>
        ))}
      </section>
    </main>
  )
}

export default function App() {
  const shellRef = useRef(null)
  const [view, setView] = useState('setup')
  const [auth, setAuth] = useState(getStoredAuth())
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('guess-a-song-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [playlistUrl, setPlaylistUrl] = useState(sessionStorage.getItem('needle-drop-playlist') || '')
  const [playlistNames, setPlaylistNames] = useState(storedPlaylistNames)
  const [rounds, setRounds] = useState(Number(sessionStorage.getItem('needle-drop-rounds')) || 5)
  const [gameMode, setGameMode] = useState(sessionStorage.getItem('guess-a-song-mode') || 'title')
  const [hintPenalty, setHintPenalty] = useState(Number(sessionStorage.getItem('guess-a-song-hint-penalty')) || 25)
  const [playlist, setPlaylist] = useState(null)
  const [gameTracks, setGameTracks] = useState([])
  const [source, setSource] = useState('demo')
  const [history, setHistory] = useState([])
  const [volume, setVolume] = useState(() => {
    const storedVolume = localStorage.getItem('guess-a-song-volume')
    if (storedVolume === null) return 0.75
    const saved = Number(storedVolume)
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.75
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [entryCount, setEntryCount] = useState(3)
  const [clientId, setClientId] = useState(localStorage.getItem('needle-drop-client-id') || auth?.clientId || '')
  const playerRef = useRef(null)
  const previousGameTrackKeysRef = useRef([])

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [view])
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('guess-a-song-theme', theme)
  }, [theme])
  useEffect(() => { sessionStorage.setItem('needle-drop-playlist', playlistUrl) }, [playlistUrl])
  useEffect(() => { sessionStorage.setItem('guess-a-song-playlist-names', JSON.stringify(playlistNames)) }, [playlistNames])
  useEffect(() => { sessionStorage.setItem('needle-drop-rounds', String(rounds)) }, [rounds])
  useEffect(() => { sessionStorage.setItem('guess-a-song-mode', gameMode) }, [gameMode])
  useEffect(() => { sessionStorage.setItem('guess-a-song-hint-penalty', String(hintPenalty)) }, [hintPenalty])
  useEffect(() => {
    if (view !== 'countdown') return undefined
    const timer = window.setTimeout(() => {
      if (entryCount <= 1) setView('game')
      else setEntryCount((value) => value - 1)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [view, entryCount])

  const currentToken = async () => {
    const next = await refreshAccessToken(getStoredAuth())
    if (!next) throw new Error('Your Spotify session expired. Please reconnect.')
    setAuth(next)
    return next.accessToken
  }

  const prepareGame = (data, mode, count = rounds) => {
    const sources = data.playlists?.length ? data.playlists : [data]
    const selected = selectPlaylistTracks(sources, count, previousGameTrackKeysRef.current)
    if (!selected.length) throw new Error('This playlist has no playable tracks.')
    previousGameTrackKeysRef.current = selected.map(trackKey)
    const combined = {
      ...data,
      name: sources.length === 1 ? sources[0].name : `${sources.length} playlist mix`,
      sources,
      songsPerPlaylist: count,
    }
    setPlaylist(combined); setGameTracks(selected); setSource(mode); setHistory([]); setEntryCount(3); setView('countdown')
  }

  const connectAndLoad = async (signedIn = auth) => {
    const ids = playlistIdsFrom(playlistUrl)
    if (!ids.length) return setError('Paste at least one valid Spotify playlist link or playlist ID.')
    if (!signedIn) {
      if (!clientId) return setSettingsOpen(true)
      return beginSpotifyLogin(clientId, playlistUrl, rounds)
    }
    setBusy(true); setError('')
    try {
      const validAuth = await refreshAccessToken(signedIn)
      if (!validAuth) { clearAuth(); setAuth(null); throw new Error('Your Spotify session expired. Please connect again.') }
      const loadedPlaylists = await Promise.all(ids.map((id) => getPlaylist(id, validAuth.accessToken)))
      const playlists = loadedPlaylists.map((item, index) => ({ ...item, name: playlistNames[ids[index]]?.trim() || item.name }))
      const data = { playlists, tracks: playlists.flatMap((item) => item.tracks) }
      if (!playerRef.current) playerRef.current = await createSpotifyPlayer(currentToken, volume)
      prepareGame(data, 'spotify')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get('code')) return
    setBusy(true)
    finishSpotifyLogin()
      .then((signedIn) => { setAuth(signedIn); setClientId(signedIn.clientId); localStorage.setItem('needle-drop-client-id', signedIn.clientId); return connectAndLoad(signedIn) })
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false))
  }, [])

  const goHome = () => { stopDemo(); playerRef.current?.player.pause().catch(() => {}); setView('setup'); setError('') }
  const playAgain = () => {
    const selected = selectPlaylistTracks(playlist.sources, playlist.songsPerPlaylist, previousGameTrackKeysRef.current)
    previousGameTrackKeysRef.current = selected.map(trackKey)
    setGameTracks(selected); setHistory([]); setEntryCount(3); setView('countdown')
  }
  const updatePlaylistName = (id, name) => setPlaylistNames((current) => ({ ...current, [id]: name }))
  const removePlaylistName = (id) => setPlaylistNames((current) => {
    const next = { ...current }
    delete next[id]
    return next
  })
  const toggleTheme = () => setTheme((value) => {
    const next = value === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
    localStorage.setItem('guess-a-song-theme', next)
    return next
  })

  const followPointer = (event) => {
    if (!shellRef.current) return
    const x = event.clientX / window.innerWidth
    const y = event.clientY / window.innerHeight
    shellRef.current.style.setProperty('--pointer-x', `${event.clientX}px`)
    shellRef.current.style.setProperty('--pointer-y', `${event.clientY}px`)
    shellRef.current.style.setProperty('--mascot-x', `${(x - .5) * 14}px`)
    shellRef.current.style.setProperty('--mascot-y', `${(y - .5) * 10}px`)
  }

  return (
    <div className={`app-shell view-${view}`} ref={shellRef} onPointerMove={followPointer}>
      <Header auth={auth} theme={theme} onToggleTheme={toggleTheme} onHome={goHome} onSettings={() => setSettingsOpen(true)} onUpdates={() => setUpdatesOpen(true)} onDisconnect={() => { clearAuth(); setAuth(null); playerRef.current?.player.disconnect(); playerRef.current = null }} />
      {view === 'setup' && <Setup {...{ auth, playlistUrl, setPlaylistUrl, playlistNames, rounds, setRounds, gameMode, setGameMode, hintPenalty, setHintPenalty, busy, error }} onPlaylistNameChange={updatePlaylistName} onRemovePlaylistName={removePlaylistName} onSpotify={() => connectAndLoad()} onDemo={() => prepareGame(DEMO_PLAYLIST, 'demo')} onSettings={() => setSettingsOpen(true)} />}
      {view === 'countdown' && <GameIntro count={entryCount} playlistName={playlist?.name} />}
      {view === 'game' && <Game key={`${gameMode}-${gameTracks.map((t) => t.id).join()}`} {...{ playlist, gameTracks, source, playerRef, volume, setVolume, gameMode, hintPenalty }} tokenGetter={currentToken} onFinish={(finalHistory) => { setHistory(finalHistory); setView('results') }} onQuit={goHome} />}
      {view === 'results' && <Results history={history} totalRounds={gameTracks.length} playlist={playlist} onAgain={playAgain} onHome={goHome} />}
      {settingsOpen && <SettingsModal initialId={clientId} onClose={() => setSettingsOpen(false)} onSave={(id) => { setClientId(id); localStorage.setItem('needle-drop-client-id', id); setSettingsOpen(false) }} />}
      {updatesOpen && <UpdateLogsModal onClose={() => setUpdatesOpen(false)} />}
      <footer><span>Built for music people.</span><span><Volume2 size={14} /> Best with headphones</span></footer>
    </div>
  )
}
