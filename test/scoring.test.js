import test from 'node:test'
import assert from 'node:assert/strict'
import { POINTS_PER_CORRECT_GUESS, pointsForGuess } from '../src/scoring.js'

test('awards exactly 100 points for a correct guess', () => {
  assert.equal(POINTS_PER_CORRECT_GUESS, 100)
  assert.equal(pointsForGuess(true), 100)
})

test('awards zero points for a wrong or skipped guess', () => {
  assert.equal(pointsForGuess(false), 0)
})
