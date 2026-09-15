import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleHelp, ExternalLink, Headphones, Info, LoaderCircle, LogOut, Music2, Pause, Play, RotateCcw, Settings2, SkipForward, Sparkles, Trophy, Volume2, X } from 'lucide-react'
import { DEMO_PLAYLIST, pauseDemo, playDemo, resumeDemo, setDemoVolume, stopDemo } from './demo.js'
import { beginSpotifyLogin, clearAuth, createSpotifyPlayer, finishSpotifyLogin, getPlaylist, getStoredAuth, playlistIdFrom, playTrack, refreshAccessToken } from './spotify.js'
import { isCorrectGuess } from './matching.js'
import { pointsForGuess } from './scoring.js'

const ROUND_SECONDS = 15

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5)
function VinylMark() {
  return <span className="brand-mark"><span /></span>
}

function Header({ auth, onHome, onSettings, onDisconnect }) {
  return (
    <header className="site-header">
      <button className="brand" onClick={onHome} aria-label="Guess a Song home">
        <VinylMark />
        <span>GUESS A <b>SONG</b><small>MUSIC QUIZ / 音楽クイズ</small></span>
      </button>
      <nav>
        <button className="icon-button" onClick={onSettings} aria-label="Spotify settings"><Settings2 size={19} /></button>
        {auth && <button className="text-button" onClick={onDisconnect}><LogOut size={16} /> Disconnect</button>}
      </nav>
    </header>
  )
}

function Setup({ auth, playlistUrl, setPlaylistUrl, rounds, setRounds, onDemo, onSpotify, busy, error, onSettings }) {
  return (
    <main className="setup-page">
      <section className="hero">
        <div className="eyebrow"><span /> Welcome to the music club</div>
        <h1>A little music.<br /><em>A new challenge.</em></h1>
        <p className="hero-copy">Your favorite playlist. Fifteen seconds to recognize it.<br />Listen, name the song, and make every round count.</p>

        <div className="setup-card">
          <div className="panel-heading"><span>01 / SESSION SETUP</span><Headphones size={19} /></div>
          <div className="field-group">
            <label htmlFor="playlist">Spotify playlist</label>
            <div className="input-shell">
              <Music2 size={20} />
              <input id="playlist" value={playlistUrl} onChange={(e) => setPlaylistUrl(e.target.value)} placeholder="Paste a playlist link or ID" />
            </div>
            <span className="field-note">In Spotify Development Mode, use a playlist you own or collaborate on.</span>
          </div>

          <div className="round-picker">
            <span>Number of rounds</span>
            <div className="segmented">
              {[5, 10, 15].map((count) => <button key={count} aria-pressed={rounds === count} className={rounds === count ? 'active' : ''} onClick={() => setRounds(count)}>{count}</button>)}
            </div>
          </div>

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
        <div className="signal-tag">♪ &nbsp; MUSIC CONNECTS US</div>
        <img className="mascot" src="/assets/guess-a-song-mascot.png" alt="" />
        <div className="preview-player">
          <div className="panel-heading"><span>LISTENING SESSION</span><span>♫</span></div>
          <div className="preview-label">A familiar melody. A fresh start.</div>
          <div className="preview-timer"><strong>15</strong><span>SECONDS</span></div>
          <Waveform remaining={15} playing={false} />
          <div className="preview-bottom"><span>READY TO LISTEN</span><span className="preview-play"><Play size={22} fill="currentColor" /></span></div>
        </div>
        <div className="reward-tag"><Sparkles size={22} /><span><strong>100 points</strong><small>Every correct answer</small></span></div>
        <span className="art-cross cross-one">+</span><span className="art-cross cross-two">+</span>
      </aside>

      <section className="how-it-works">
        <div><b>01</b><span><strong>Pick a playlist</strong>Your songs, your difficulty.</span></div>
        <div><b>02</b><span><strong>Listen for 15 sec</strong>A random moment, no spoilers.</span></div>
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

function Waveform({ remaining, playing }) {
  const bars = useMemo(() => Array.from({ length: 54 }, (_, i) => 20 + Math.abs(Math.sin(i * 1.77) * 50) + ((i * 17) % 22)), [])
  const elapsed = (ROUND_SECONDS - remaining) / ROUND_SECONDS
  return <div className={`waveform ${playing ? 'playing' : ''}`}>{bars.map((height, i) => <i key={i} className={i / bars.length < elapsed ? 'heard' : ''} style={{ height: `${height}%`, animationDelay: `${(i % 9) * -0.08}s` }} />)}</div>
}

function Game({ playlist, gameTracks, source, playerRef, tokenGetter, volume, setVolume, onFinish, onQuit }) {
  const [round, setRound] = useState(0)
  const [remaining, setRemaining] = useState(ROUND_SECONDS)
  const [guess, setGuess] = useState('')
  const [phase, setPhase] = useState('ready')
  const [history, setHistory] = useState([])
  const [audioError, setAudioError] = useState('')
  const timerRef = useRef(null)
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

  const startClip = async () => {
    setAudioError('')
    setPhase('playing')
    setRemaining(ROUND_SECONDS)
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
    setRemaining(ROUND_SECONDS)
    await startClip()
  }

  const changeVolume = (event) => {
    const nextVolume = Number(event.target.value)
    setVolume(nextVolume)
    localStorage.setItem('guess-a-song-volume', String(nextVolume))
    if (source === 'demo') setDemoVolume(nextVolume)
    else playerRef.current?.player.setVolume(nextVolume).catch(() => {})
  }

  useEffect(() => () => { window.clearInterval(timerRef.current); stopDemo(); playerRef.current?.player.pause().catch(() => {}) }, [])

  const submit = async (skipped = false) => {
    if (phase === 'revealed' || (!guess.trim() && !skipped)) return
    await stopAudio()
    const correct = !skipped && isCorrectGuess(guess, current.title)
    const points = pointsForGuess(correct)
    setHistory((items) => [...items, { track: current, guess: skipped ? '' : guess, correct, points }])
    setPhase('revealed')
  }

  const next = () => {
    if (round + 1 >= gameTracks.length) return onFinish(history)
    setRound((value) => value + 1)
    setRemaining(ROUND_SECONDS)
    setGuess('')
    setPhase('ready')
    setAudioError('')
    clipStartRef.current = null
  }

  const lastResult = history[history.length - 1]
  return (
    <main className="game-page">
      <div className="game-topline">
        <button className="back-link" onClick={onQuit}><ArrowLeft size={17} /> Leave game</button>
        <div className="round-dots">{gameTracks.map((_, i) => <i key={i} className={i < round ? 'done' : i === round ? 'current' : ''} />)}</div>
        <span className="score"><small>SCORE</small>{score.toLocaleString()}</span>
      </div>

      <section className={`game-card phase-${phase}`}>
        <div className="round-label">ROUND {round + 1} <span>/ {gameTracks.length}</span></div>
        {phase !== 'revealed' ? (
          <>
            <h2>{phase === 'ready' ? 'Ready when you are' : phase === 'playing' ? 'Name that song' : phase === 'paused' ? 'Clip paused' : 'What did you hear?'}</h2>
            <p className="game-prompt">{phase === 'ready' ? 'Press play for your 15-second clip.' : phase === 'playing' ? 'Type your answer while the music plays.' : phase === 'paused' ? 'Resume when you’re ready, or listen again from the start.' : 'Time’s up — take your best shot.'}</p>
            <div className="timer-row"><span className="time">0:{String(remaining).padStart(2, '0')}</span><Waveform remaining={remaining} playing={phase === 'playing'} /></div>
            <label className="volume-control">
              <Volume2 size={17} aria-hidden="true" />
              <span>Volume</span>
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={changeVolume} style={{ '--volume': volume }} aria-label="Playback volume" />
              <output>{Math.round(volume * 100)}%</output>
            </label>
            {audioError && <div className="error-banner compact"><Info size={17} />{audioError}</div>}
            {phase === 'ready' ? (
              <button className="listen-button" onClick={startClip}><Play size={24} fill="currentColor" /> Play clip</button>
            ) : (
              <>
                <div className="playback-controls">
                  {phase !== 'guessing' && <button type="button" onClick={phase === 'playing' ? pauseClip : resumeClip}>{phase === 'playing' ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}{phase === 'playing' ? 'Pause' : 'Resume'}</button>}
                  <button type="button" onClick={replayClip}><RotateCcw size={16} /> Re-listen</button>
                </div>
                <form className="guess-form" onSubmit={(e) => { e.preventDefault(); submit() }}>
                  <input autoFocus value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Type the song title…" aria-label="Song title" />
                  <button type="submit" disabled={!guess.trim()}>Guess <ArrowRight size={18} /></button>
                </form>
              </>
            )}
            {phase !== 'ready' && <button className="skip-button" onClick={() => submit(true)}>I don’t know <SkipForward size={15} /></button>}
          </>
        ) : (
          <div className="reveal">
            {lastResult.correct && <div className="celebration" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--spark': i }} />)}</div>}
            <img className={`result-face ${lastResult.correct ? 'happy' : 'sad'}`} src={lastResult.correct ? '/assets/mascot-face-happy.png' : '/assets/mascot-face-sad.png'} alt={lastResult.correct ? 'Mascot celebrating the correct answer' : 'Mascot looking sad about the incorrect answer'} />
            <div className={`result-badge ${lastResult.correct ? 'correct' : 'wrong'}`}>{lastResult.correct ? <Check size={19} /> : <X size={19} />}{lastResult.correct ? 'Nailed it' : 'Not this time'}</div>
            {current.art ? <img className="album-art" src={current.art} alt={`${current.album} cover`} /> : <div className="album-art demo-art" style={{ '--art-color': current.color }}><VinylMark /><span>{current.album}</span></div>}
            <h2>{current.title}</h2>
            <p className="artist">{current.artist}</p>
            {!lastResult.correct && lastResult.guess && <p className="your-guess">Your guess: <s>{lastResult.guess}</s></p>}
            <div className="points-earned">+{lastResult.points} <span>points</span></div>
            {current.spotifyUrl && <a className="spotify-attribution" href={current.spotifyUrl} target="_blank" rel="noreferrer">Listen on Spotify <ExternalLink size={14} /></a>}
            <button className="primary-button next-button" onClick={next}>{round + 1 === gameTracks.length ? 'See my results' : 'Next song'} <ArrowRight size={19} /></button>
          </div>
        )}
      </section>
      <div className="playlist-caption"><Headphones size={16} /><span>Playing from</span><strong>{playlist.name}</strong></div>
    </main>
  )
}

function Results({ history, totalRounds, playlist, onAgain, onHome }) {
  const correct = history.filter((item) => item.correct).length
  const score = history.reduce((sum, item) => sum + item.points, 0)
  const percent = Math.round((correct / totalRounds) * 100)
  const message = percent === 100 ? 'Perfect pitch.' : percent >= 70 ? 'You know your tunes.' : percent >= 40 ? 'A solid set.' : 'Time for an encore.'
  return (
    <main className="results-page">
      <section className="results-summary">
        <img className="results-mascot" src="/assets/guess-a-song-mascot.png" alt="Guess a Song music club mascot" />
        <div className="trophy"><Trophy /></div>
        <div className="eyebrow"><span /> Set complete</div>
        <h1>{message}</h1>
        <p>{playlist.name} put you to the test.</p>
        <div className="big-score"><strong>{score.toLocaleString()}</strong><span>POINTS</span></div>
        <div className="stats"><div><strong>{correct}/{totalRounds}</strong><span>Correct</span></div><div><strong>{percent}%</strong><span>Hit rate</span></div><div><strong>{Math.max(0, ...history.map((item) => item.points))}</strong><span>Best round</span></div></div>
        <div className="results-actions"><button className="primary-button" onClick={onAgain}><RotateCcw size={18} /> Play again</button><button className="secondary-button" onClick={onHome}>Change playlist</button></div>
      </section>
      <section className="track-list">
        <div className="list-heading"><h2>Your setlist</h2><span>{correct} of {totalRounds} correct</span></div>
        {history.map((item, i) => (
          <div className="track-row" key={`${item.track.id}-${i}`}>
            <span className={`track-status ${item.correct ? 'correct' : 'wrong'}`}>{item.correct ? <Check size={17} /> : <X size={17} />}</span>
            <span className="track-number">{String(i + 1).padStart(2, '0')}</span>
            <div><strong>{item.track.title}</strong><span>{item.track.artist}</span></div>
            <b>+{item.points}</b>
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
  const [playlistUrl, setPlaylistUrl] = useState(sessionStorage.getItem('needle-drop-playlist') || '')
  const [rounds, setRounds] = useState(Number(sessionStorage.getItem('needle-drop-rounds')) || 5)
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
  const [clientId, setClientId] = useState(localStorage.getItem('needle-drop-client-id') || auth?.clientId || '')
  const playerRef = useRef(null)

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [view])

  const currentToken = async () => {
    const next = await refreshAccessToken(getStoredAuth())
    if (!next) throw new Error('Your Spotify session expired. Please reconnect.')
    setAuth(next)
    return next.accessToken
  }

  const prepareGame = (data, mode, count = rounds) => {
    const selected = shuffle(data.tracks).slice(0, Math.min(count, data.tracks.length))
    if (!selected.length) throw new Error('This playlist has no playable tracks.')
    setPlaylist(data); setGameTracks(selected); setSource(mode); setHistory([]); setView('game')
  }

  const connectAndLoad = async (signedIn = auth) => {
    const id = playlistIdFrom(playlistUrl)
    if (!id) return setError('Paste a valid Spotify playlist link or playlist ID.')
    if (!signedIn) {
      if (!clientId) return setSettingsOpen(true)
      return beginSpotifyLogin(clientId, playlistUrl, rounds)
    }
    setBusy(true); setError('')
    try {
      const validAuth = await refreshAccessToken(signedIn)
      if (!validAuth) { clearAuth(); setAuth(null); throw new Error('Your Spotify session expired. Please connect again.') }
      const data = await getPlaylist(id, validAuth.accessToken)
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
  const playAgain = () => { setGameTracks(shuffle(playlist.tracks).slice(0, gameTracks.length)); setHistory([]); setView('game') }

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
      <Header auth={auth} onHome={goHome} onSettings={() => setSettingsOpen(true)} onDisconnect={() => { clearAuth(); setAuth(null); playerRef.current?.player.disconnect(); playerRef.current = null }} />
      {view === 'setup' && <Setup {...{ auth, playlistUrl, setPlaylistUrl, rounds, setRounds, busy, error }} onSpotify={() => connectAndLoad()} onDemo={() => prepareGame(DEMO_PLAYLIST, 'demo')} onSettings={() => setSettingsOpen(true)} />}
      {view === 'game' && <Game key={gameTracks.map((t) => t.id).join()} {...{ playlist, gameTracks, source, playerRef, volume, setVolume }} tokenGetter={currentToken} onFinish={(finalHistory) => { setHistory(finalHistory); setView('results') }} onQuit={goHome} />}
      {view === 'results' && <Results history={history} totalRounds={gameTracks.length} playlist={playlist} onAgain={playAgain} onHome={goHome} />}
      {settingsOpen && <SettingsModal initialId={clientId} onClose={() => setSettingsOpen(false)} onSave={(id) => { setClientId(id); localStorage.setItem('needle-drop-client-id', id); setSettingsOpen(false) }} />}
      <footer><span>Built for music people.</span><span><Volume2 size={14} /> Best with headphones</span></footer>
    </div>
  )
}
