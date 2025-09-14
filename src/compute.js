export function totalVotes(candidates) {
  return candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
}

export function augmentCandidates(cands) {
  const total = totalVotes(cands);
  return cands
    .map(c => ({
      ...c,
      percent: total ? (c.votes / total) * 100 : 0
    }))
    .sort((a, b) => b.votes - a.votes);
}

export function leaderAndMargin(cands) {
  if (cands.length < 2) return { leader: cands[0] || null, marginPct: 0 };
  const [first, second] = cands;
  const total = totalVotes(cands);
  const marginPct = total ? ((first.votes - second.votes) / total) * 100 : 0;
  return { leader: first, marginPct };
}
