export const DEMO_PLAYLIST = {
  name: 'After Hours Radio',
  owner: 'Guess a Song',
  tracks: [
    { id: 'demo-1', title: 'Midnight Drive', artist: 'The Night Owls', album: 'Neon Streets', color: '#ef6f3c', notes: [220, 277, 330, 415] },
    { id: 'demo-2', title: 'Golden Hour', artist: 'June & The Sun', album: 'Slow Light', color: '#f3b33d', notes: [262, 330, 392, 330] },
    { id: 'demo-3', title: 'Electric Heart', artist: 'Violet Arcade', album: 'Static Dreams', color: '#b35cff', notes: [196, 247, 294, 370] },
    { id: 'demo-4', title: 'Ocean Eyes', artist: 'Coastline Club', album: 'Blue Again', color: '#4aa9c7', notes: [175, 220, 262, 349] },
    { id: 'demo-5', title: 'Paper Planes', artist: 'Sunday Kids', album: 'Window Seat', color: '#83ad54', notes: [294, 370, 440, 370] },
    { id: 'demo-6', title: 'Cherry Skies', artist: 'Marlow', album: 'Postcards', color: '#df5571', notes: [247, 311, 370, 466] },
    { id: 'demo-7', title: 'Slow Motion', artist: 'Bedroom Cinema', album: 'Soft Focus', color: '#6d75d8', notes: [208, 262, 311, 392] },
  ],
}

let context
let interval
let masterGain

export function playDemo(track, volume = 0.75) {
  stopDemo()
  context = new (window.AudioContext || window.webkitAudioContext)()
  masterGain = context.createGain()
  masterGain.gain.value = 0.16 * volume
  masterGain.connect(context.destination)
  let index = 0
  const playNote = () => {
    const now = context.currentTime
    const osc = context.createOscillator()
    const bass = context.createOscillator()
    const gain = context.createGain()
    osc.type = 'triangle'
    bass.type = 'sine'
    osc.frequency.value = track.notes[index % track.notes.length]
    bass.frequency.value = track.notes[index % track.notes.length] / 2
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.7, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.42)
    osc.connect(gain); bass.connect(gain); gain.connect(masterGain)
    osc.start(now); bass.start(now); osc.stop(now + 0.45); bass.stop(now + 0.45)
    index += 1
  }
  playNote()
  interval = window.setInterval(playNote, 480)
}

export function stopDemo() {
  window.clearInterval(interval)
  interval = null
  if (context) context.close().catch(() => {})
  context = null
  masterGain = null
}

export function setDemoVolume(volume) {
  if (context && masterGain) masterGain.gain.setTargetAtTime(0.16 * volume, context.currentTime, 0.02)
}

export function pauseDemo() {
  return context?.suspend() || Promise.resolve()
}

export function resumeDemo() {
  return context?.resume() || Promise.resolve()
}
