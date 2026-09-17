const MILESTONES = {
  3: {
    streak: 3,
    label: 'In Sync',
    message: 'Three in a row — the whole group is locked in.',
  },
  5: {
    streak: 5,
    label: 'On Fire',
    message: 'Five straight songs. This room knows its music.',
  },
  10: {
    streak: 10,
    label: 'Perfect Harmony',
    message: 'Ten in a row — a legendary group performance.',
  },
}

export function trailingStreak(history) {
  let streak = 0
  for (let index = history.length - 1; index >= 0 && history[index].correct; index -= 1) streak += 1
  return streak
}

export function streakMilestone(streak) {
  return MILESTONES[streak] || null
}

export function summarizeSession(history, totalRounds = history.length) {
  const correct = history.filter((item) => item.correct).length
  const score = history.reduce((sum, item) => sum + item.points, 0)
  const percent = totalRounds ? Math.round((score / (totalRounds * 100)) * 100) : 0
  const bestStreak = Math.max(0, ...history.map((item) => item.streak || 0))
  const cleanWins = history.filter((item) => item.correct && !item.hintsUsed && !item.replaysUsed && !item.introStage).length
  const totalHints = history.reduce((sum, item) => sum + (item.hintsUsed || 0), 0)
  const totalRelistens = history.reduce((sum, item) => sum + (item.replaysUsed || 0), 0)
  const totalExtensions = history.reduce((sum, item) => sum + (item.introStage || 0), 0)
  const burden = (item) => (item.hintsUsed || 0) * 2 + (item.replaysUsed || 0) + (item.introStage || 0)
  const hardestRound = history.reduce((hardest, item) => {
    if (!hardest) return item
    if (!item.correct && hardest.correct) return item
    if (item.correct === hardest.correct && burden(item) > burden(hardest)) return item
    return hardest
  }, null)
  const rating = bestStreak >= 10
    ? 'Perfect harmony.'
    : bestStreak >= 5
      ? 'On fire together.'
      : bestStreak >= 3
        ? 'Perfectly in sync.'
        : percent >= 60
          ? 'Finding the rhythm.'
          : 'Warm-up complete.'

  return { correct, score, percent, bestStreak, cleanWins, totalHints, totalRelistens, totalExtensions, hardestRound, rating }
}
