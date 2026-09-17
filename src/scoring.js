export const POINTS_PER_CORRECT_GUESS = 100
export const POINTS_PER_HINT = 25
export const POINTS_PER_INTRO_EXTENSION = 25

export function pointsForGuess(correct, hintsUsed = 0, pointsPerHint = POINTS_PER_HINT) {
  if (!correct) return 0
  const deductions = Math.max(0, hintsUsed) * Math.max(0, pointsPerHint)
  return Math.max(0, POINTS_PER_CORRECT_GUESS - deductions)
}

export function pointsForIntroGuess(correct, extensionStage = 0, hintsUsed = 0, pointsPerHint = POINTS_PER_HINT) {
  if (!correct) return 0
  const extendedClipDeduction = Math.max(0, extensionStage) * POINTS_PER_INTRO_EXTENSION
  return Math.max(0, pointsForGuess(true, hintsUsed, pointsPerHint) - extendedClipDeduction)
}
