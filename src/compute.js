<<<<<<< Updated upstream
=======
// Computation utilities (votes, percentages, margins)

>>>>>>> Stashed changes
export function totalVotes(candidates) {
  return candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
}

<<<<<<< Updated upstream
export function augmentCandidates(cands) {
  const total = totalVotes(cands);
  return cands
=======
// Adds percent to each candidate and sorts descending
export function augmentCandidates(candidates) {
  const total = totalVotes(candidates) || 0;
  return candidates
>>>>>>> Stashed changes
    .map(c => ({
      ...c,
      percent: total ? (c.votes / total) * 100 : 0
    }))
    .sort((a, b) => b.votes - a.votes);
}

<<<<<<< Updated upstream
export function leaderAndMargin(cands) {
  if (cands.length < 2) return { leader: cands[0] || null, marginPct: 0 };
  const [first, second] = cands;
  const total = totalVotes(cands);
  const marginPct = total ? ((first.votes - second.votes) / total) * 100 : 0;
  return { leader: first, marginPct };
}
=======
// Compute leader and margin percent (leader% - runnerUp%)
export function leaderAndMargin(candidates) {
  if (!candidates || candidates.length < 2) {
    return { leader: candidates[0] || null, marginPct: 0 };
  }
  const augmented = augmentCandidates(candidates);
  const [leader, runner] = augmented;
  const marginPct = leader.percent - runner.percent;
  return { leader, marginPct: marginPct > 0 ? marginPct : 0 };
}
>>>>>>> Stashed changes
