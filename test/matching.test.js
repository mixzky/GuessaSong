import test from 'node:test'
import assert from 'node:assert/strict'
import { extractSongTitle, isCorrectGuess, normalizeTitle } from '../src/matching.js'

test('preserves Thai letters, vowels, and tone marks', () => {
  assert.equal(normalizeTitle('ถ้าเราเจอกันอีก'), 'ถ้าเราเจอกันอีก')
})

test('accepts an exact Thai song title', () => {
  assert.equal(isCorrectGuess('ถ้าเราเจอกันอีก', 'ถ้าเราเจอกันอีก'), true)
})

test('ignores surrounding punctuation and version labels for Thai titles', () => {
  assert.equal(isCorrectGuess('วาดไว้', 'วาดไว้ (Acoustic Version)'), true)
})

test('allows a small Thai typo in a long title', () => {
  assert.equal(isCorrectGuess('คำยินด', 'คำยินดี'), true)
})

test('does not accept unrelated Thai titles', () => {
  assert.equal(isCorrectGuess('ลาลาลอย', 'ถ้าเราเจอกันอีก'), false)
})

test('keeps the existing Latin title behavior', () => {
  assert.equal(isCorrectGuess('Midnight Driv', 'Midnight Drive - Remastered'), true)
})

test('accepts an exact Japanese title with kanji and kana', () => {
  assert.equal(isCorrectGuess('夜に駆ける', '夜に駆ける'), true)
})

test('treats hiragana and katakana spellings as equivalent', () => {
  assert.equal(isCorrectGuess('あいどる', 'アイドル'), true)
})

test('normalizes half-width Japanese characters', () => {
  assert.equal(isCorrectGuess('ｱｲﾄﾞﾙ', 'アイドル'), true)
})

test('ignores Japanese punctuation around a title', () => {
  assert.equal(isCorrectGuess('「怪物」', '怪物'), true)
})

test('does not accept unrelated Japanese titles', () => {
  assert.equal(isCorrectGuess('怪物', '夜に駆ける'), false)
})

test('accepts guesses with at least 70 percent title similarity', () => {
  assert.equal(isCorrectGuess('abcxyfg', 'abcdefg'), true)
})

test('rejects guesses below 70 percent title similarity', () => {
  assert.equal(isCorrectGuess('abcxyzg', 'abcdefg'), false)
})

test('extracts a Thai soundtrack label from a Spotify title', () => {
  assert.equal(
    extractSongTitle('ทุ้มอยู่ในใจ - เพลงประกอบภาพยนตร์ "SuckSeed ห่วยขั้นเทพ"'),
    'ทุ้มอยู่ในใจ',
  )
})

test('keeps a legitimate dashed song title intact', () => {
  assert.equal(extractSongTitle('Love - Hate'), 'Love - Hate')
})
