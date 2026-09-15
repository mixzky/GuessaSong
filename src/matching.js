export function normalizeTitle(value) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    // Fold katakana into hiragana so phonetic spellings such as アイドル and
    // あいどる compare equally. NFKC above also folds half-width katakana.
    .replace(/[\u30A1-\u30F6\u30FD\u30FE]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    )
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/\b(feat|ft|featuring|remaster(ed)?|version|edit)\b.*$/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
}

// Keep the actual title while removing common Spotify metadata appended after a dash.
// This is deliberately conservative so titles that genuinely contain a dash stay intact.
export function extractSongTitle(value) {
  return value
    .normalize('NFKC')
    .replace(/\s+[-–—]\s+(?=(?:เพลงประกอบ(?:ภาพยนตร์|ละคร|ซีรีส์|เกม)?|จาก(?:ภาพยนตร์|ละคร|ซีรีส์)|soundtrack\b|original\s+(?:motion\s+picture|soundtrack)\b|from\b|ost\b|theme\b|opening\b|ending\b|remaster(?:ed)?\b|live\b|acoustic\b|version\b|edit\b|mix\b|feat(?:uring)?\b|ft\b)).*$/iu, '')
    .trim()
}

function graphemes(value) {
  if (typeof Intl?.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
      .map(({ segment }) => segment)
  }
  return Array.from(value)
}

function editDistance(first, second) {
  const a = graphemes(first)
  const b = graphemes(second)
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = saved
    }
  }
  return row[b.length]
}

export function isCorrectGuess(guess, answer) {
  const a = normalizeTitle(guess)
  const b = normalizeTitle(answer)
  if (!a || !b) return false
  if (a === b) return true
  const guessLength = graphemes(a).length
  const answerLength = graphemes(b).length
  const distance = editDistance(a, b)
  const similarity = 1 - distance / Math.max(guessLength, answerLength)
  return similarity >= 0.7
}
