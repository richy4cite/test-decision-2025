// Only minor tweak: trusts transformed structure (no change needed if you already used earlier version)
// Included here for completeness in case you need consistent references.
import { fmtNumber, fmtPercent } from './format.js';
import { augmentCandidates, leaderAndMargin } from './compute.js';

export function renderLeaderBoard(rootEl, candidates) {
  rootEl.innerHTML = '';
  const aug = augmentCandidates(candidates);
  const maxVotes = aug[0]?.votes || 1;
  aug.forEach(c => {
    const card = document.createElement('div');
    card.className = 'leader-card party-' + (c.party?.toLowerCase() || 'oth');
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div class="candidate-row">
        <span class="candidate-name">${c.name}</span>
        <span class="candidate-votes">${fmtNumber(c.votes)}</span>
      </div>
      <div class="bar-wrap">
        <div class="bar" style="width:${(c.votes / maxVotes) * 100}%;"></div>
        <span class="pct">${fmtPercent(c.percent)}</span>
      </div>
    `;
    rootEl.appendChild(card);
  });
}

export function renderStateTable(tbody, states, candidatesIndex) {
  tbody.innerHTML = '';
  states.forEach(st => {
    const row = document.createElement('tr');
    const aug = augmentCandidates(st.candidates.map(sc => ({
      ...sc,
      name: candidatesIndex[sc.id]?.name || sc.id,
      party: candidatesIndex[sc.id]?.party || 'OTH'
    })));
    const { leader, marginPct } = leaderAndMargin(aug);
    row.dataset.state = st.code;
    row.innerHTML = `
      <th scope="row">${st.name}</th>
      <td>${fmtPercent(st.reportingPct)}</td>
      <td class="leader party-${leader?.party?.toLowerCase() || 'oth'}">${leader?.name || '—'}</td>
      <td>${leader ? (marginPct >= 0 ? '+' + fmtPercent(marginPct) : fmtPercent(marginPct)) : '—'}</td>
    `;
    tbody.appendChild(row);
  });
}

export function renderDrilldown(panel, stateObj, candidatesIndex) {
  if (!stateObj) {
    panel.innerHTML = '<p>Select a state for more detail.</p>';
    return;
  }
  const aug = stateObj.candidates.map(c => ({
    ...c,
    name: candidatesIndex[c.id]?.name || c.id,
    party: candidatesIndex[c.id]?.party || 'OTH'
  }));
  const total = aug.reduce((s, c) => s + c.votes, 0);
  panel.innerHTML = `
    <h3>${stateObj.name}</h3>
    <p>Reporting: ${stateObj.reportingPct.toFixed(1)}%</p>
    <ul class="state-candidate-list">
      ${aug.sort((a,b)=>b.votes-a.votes).map(c => `
        <li class="party-${c.party.toLowerCase()}">
          <span class="nm">${c.name}</span>
            <span class="votes">${fmtNumber(c.votes)}</span>
            <span class="pct">${total ? ((c.votes / total) * 100).toFixed(1) : '0.0'}%</span>
        </li>
      `).join('')}
    </ul>
  `;
}
