import test from 'node:test'
import assert from 'node:assert/strict'
import { POINTS_PER_CORRECT_GUESS, POINTS_PER_HINT, POINTS_PER_INTRO_EXTENSION, pointsForGuess, pointsForIntroGuess } from '../src/scoring.js'

test('awards exactly 100 points for a correct guess', () => {
  assert.equal(POINTS_PER_CORRECT_GUESS, 100)
  assert.equal(pointsForGuess(true), 100)
})

test('deducts 25 points for every hint without producing a negative score', () => {
  assert.equal(POINTS_PER_HINT, 25)
  assert.equal(pointsForGuess(true, 1), 75)
  assert.equal(pointsForGuess(true, 2), 50)
  assert.equal(pointsForGuess(true, 3), 25)
  assert.equal(pointsForGuess(true, 5), 0)
})

test('supports a configurable hint penalty', () => {
  assert.equal(pointsForGuess(true, 3, 10), 70)
  assert.equal(pointsForGuess(true, 2, 20), 60)
})

test('reduces Intro Rush points as the clip grows from 5 to 30 seconds', () => {
  assert.equal(POINTS_PER_INTRO_EXTENSION, 25)
  assert.equal(pointsForIntroGuess(true, 0), 100)
  assert.equal(pointsForIntroGuess(true, 1), 75)
  assert.equal(pointsForIntroGuess(true, 2), 50)
  assert.equal(pointsForIntroGuess(true, 3), 25)
})

test('stacks Intro Rush and hint deductions without going below zero', () => {
  assert.equal(pointsForIntroGuess(true, 1, 1, 20), 55)
  assert.equal(pointsForIntroGuess(true, 3, 2, 25), 0)
  assert.equal(pointsForIntroGuess(false, 0), 0)
})

test('awards zero points for a wrong or skipped guess', () => {
  assert.equal(pointsForGuess(false), 0)
  assert.equal(pointsForGuess(false, 2), 0)
})
