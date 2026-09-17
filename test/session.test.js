import test from 'node:test'
import assert from 'node:assert/strict'
import { streakMilestone, summarizeSession, trailingStreak } from '../src/session.js'

test('trailingStreak counts only the current run of correct rounds', () => {
  assert.equal(trailingStreak([{ correct: true }, { correct: false }, { correct: true }, { correct: true }]), 2)
  assert.equal(trailingStreak([{ correct: true }, { correct: false }]), 0)
})

test('streakMilestone celebrates exact cooperative milestones', () => {
  assert.equal(streakMilestone(3).label, 'In Sync')
  assert.equal(streakMilestone(5).label, 'On Fire')
  assert.equal(streakMilestone(10).label, 'Perfect Harmony')
  assert.equal(streakMilestone(4), null)
})

test('summarizeSession builds the cooperative recap', () => {
  const easy = { id: 'easy', title: 'Easy song' }
  const hard = { id: 'hard', title: 'Hard song' }
  const summary = summarizeSession([
    { track: easy, correct: true, points: 100, streak: 1, hintsUsed: 0, replaysUsed: 0, introStage: 0 },
    { track: hard, correct: false, points: 0, streak: 0, hintsUsed: 2, replaysUsed: 1, introStage: 1 },
    { track: easy, correct: true, points: 75, streak: 1, hintsUsed: 1, replaysUsed: 2, introStage: 0 },
  ], 3)

  assert.equal(summary.score, 175)
  assert.equal(summary.cleanWins, 1)
  assert.equal(summary.totalHints, 3)
  assert.equal(summary.totalRelistens, 3)
  assert.equal(summary.totalExtensions, 1)
  assert.equal(summary.hardestRound.track.id, 'hard')
})
