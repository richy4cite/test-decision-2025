<<<<<<< Updated upstream
// Transforms the raw 2025-data.json structure into the normalized structure
// expected by render.js and app.js.
function slugify(str) {
  return str
=======
// Raw -> normalized transformation

function slugify(str) {
  return String(str || '')
    .trim()
>>>>>>> Stashed changes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

<<<<<<< Updated upstream
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
=======
function deriveBoxPct(boxStr) {
  if (typeof boxStr !== 'string') return null;
  const m = boxStr.match(/(\\d+)\\s*of\\s*(\\d+)/i);
  if (!m) return null;
  const counted = parseInt(m[1], 10);
  const total = parseInt(m[2], 10);
  if (!total) return null;
  return (counted / total) * 100;
}

function makeStateCode(name) {
  return String(name || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 14) || 'UNKNOWN';
}

export function transformRaw(raw) {
  const states = [];
  const nationalCandidateMap = new Map();

  if (!raw || typeof raw !== 'object') {
    return {
      race: {
        office: 'Parliamentary Results',
        lastUpdated: new Date().toISOString(),
        nationalReportingPct: 0
      },
      candidates: [],
      states: []
    };
  }

  const keys = Object.keys(raw);
  for (const k of keys) {
    const entry = raw[k];
    if (!entry) continue;
    const name = entry.Name || entry.name || k;
    const firstDatum = Array.isArray(entry.Data) ? entry.Data[0] : null;
    if (!firstDatum) continue;

    let reportingPct = null;
    if (typeof firstDatum['Box Counted Percentage'] === 'number') {
      reportingPct = firstDatum['Box Counted Percentage'];
    } else {
      reportingPct = deriveBoxPct(firstDatum['Boxes Counted']);
    }
    if (reportingPct == null || Number.isNaN(reportingPct)) reportingPct = 0;

    const candObjs = Array.isArray(firstDatum.Candidates)
      ? firstDatum.Candidates
      : [];

    const stateCandidates = [];
    for (const cand of candObjs) {
      const fullName = `${cand['First Name'] || ''} ${cand['Last Name'] || ''}`.trim();
      const partyRaw = cand.Party || '';
      const party = partyRaw.toUpperCase();
      const id = slugify(`${fullName}-${party}`);
      const votes = typeof cand.Votes === 'number' ? cand.Votes : 0;

      // Aggregate to national
      const existing = nationalCandidateMap.get(id);
      if (existing) {
        existing.votes += votes;
      } else {
        nationalCandidateMap.set(id, {
          id,
            name: fullName,
            party,
            votes
        });
      }
      stateCandidates.push({ id, name: fullName, party, votes });
    }
>>>>>>> Stashed changes

    states.push({
      code: makeStateCode(name),
      name,
      reportingPct,
<<<<<<< Updated upstream
      candidates
    });
  });

  const nationalCandidates = Object.values(nationalCandidateAccumulator)
    .sort((a, b) => b.votes - a.votes);

  // compute nationalReportingPct (simple average of state reporting pct)
  const nationalReportingPct = states.length
    ? states.reduce((s, st) => s + (st.reportingPct || 0), 0) / states.length
    : 0;
=======
      candidates: stateCandidates
    });
  }

  const stateReporting = states.map(s => s.reportingPct);
  const nationalReportingPct =
    stateReporting.length
      ? stateReporting.reduce((a, b) => a + b, 0) / stateReporting.length
      : 0;

  const candidates = Array.from(nationalCandidateMap.values());
>>>>>>> Stashed changes

  return {
    race: {
      office: 'Parliamentary Results',
      lastUpdated: new Date().toISOString(),
      nationalReportingPct
    },
<<<<<<< Updated upstream
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
=======
    candidates,
    states
  };
}
>>>>>>> Stashed changes
