// Transforms the raw 2025-data.json structure into the normalized structure
// expected by render.js and app.js.
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function transformRaw(raw) {
  // raw is an object keyed by numeric strings
  const stateEntries = Object.entries(raw)
    .filter(([, v]) => v && typeof v === 'object');

  const states = [];
  const nationalCandidateAccumulator = {}; // key: candidateId

  stateEntries.forEach(([key, value]) => {
    const name = value.Name?.trim() || `Region ${key}`;
    // Each value.Data is an array; we assume first element holds totals
    const mainRecord = Array.isArray(value.Data) ? value.Data[0] : null;
    if (!mainRecord) return;

    const reportingPct = typeof mainRecord["Box Counted Percentage"] === 'number'
      ? mainRecord["Box Counted Percentage"]
      : deriveBoxPct(mainRecord["Boxes Counted"]);

    const candidates = Array.isArray(mainRecord.Candidates)
      ? mainRecord.Candidates.map(c => {
          const fullName = `${(c["First Name"] || '').trim()} ${(c["Last Name"] || '').trim()}`.trim();
          const party = (c.Party || 'OTH').trim();
          const id = slugify(`${fullName}-${party}`);
          const votes = c.Votes || 0;
          // accumulate national
          if (!nationalCandidateAccumulator[id]) {
            nationalCandidateAccumulator[id] = {
              id,
              name: fullName,
              party,
              votes: 0
            };
          }
            nationalCandidateAccumulator[id].votes += votes;
          return {
            id,
            name: fullName,
            party,
            votes
          };
        })
      : [];

    states.push({
      code: makeStateCode(name),
      name,
      reportingPct,
      candidates
    });
  });

  const nationalCandidates = Object.values(nationalCandidateAccumulator)
    .sort((a, b) => b.votes - a.votes);

  // compute nationalReportingPct (simple average of state reporting pct)
  const nationalReportingPct = states.length
    ? states.reduce((s, st) => s + (st.reportingPct || 0), 0) / states.length
    : 0;

  return {
    race: {
      office: 'Parliamentary Results',
      lastUpdated: new Date().toISOString(),
      nationalReportingPct
    },
    candidates: nationalCandidates,
    states
  };
}

function deriveBoxPct(str) {
  // Format: "90 of 90"
  if (!str || typeof str !== 'string') return 0;
  const m = str.match(/(\d+)\s+of\s+(\d+)/i);
  if (!m) return 0;
  const counted = parseInt(m[1], 10);
  const total = parseInt(m[2], 10);
  if (!total) return 0;
  return (counted / total) * 100;
}

function makeStateCode(name) {
  // e.g. "KINGSTON WESTERN" -> KINGSTONWESTERN (cap, no spaces)
  return name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 14);
}
