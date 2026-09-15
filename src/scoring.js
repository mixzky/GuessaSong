export const POINTS_PER_CORRECT_GUESS = 100

export function pointsForGuess(correct) {
  return correct ? POINTS_PER_CORRECT_GUESS : 0
}
