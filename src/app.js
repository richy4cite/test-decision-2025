import { renderLeaderBoard, renderStateTable, renderDrilldown } from './render.js';
import { fmtPercent, timeAgo } from './format.js';

const DATA_URL = 'data/2025-data.json';
const REFRESH_MS = 60000;

let cache = null;
let lastFetch = null;
let timerId = null;
let currentSort = 'state';
let selectedStateCode = null;

const els = {
  leaderRoot: document.getElementById('leader-cards'),
  stateTbody: document.getElementById('state-tbody'),
  stateDrill: document.getElementById('state-drilldown'),
  raceTitle: document.getElementById('race-title'),
  reportingSummary: document.getElementById('reporting-summary'),
  lastUpdated: document.getElementById('last-updated'),
  sortButtons: document.querySelectorAll('.table-controls button')
};

function indexCandidates(cands) {
  const map = {};
  cands.forEach(c => map[c.id] = c);
  return map;
}

function sortStates(states) {
  const s = [...states];
  if (currentSort === 'state') {
    s.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === 'reporting') {
    s.sort((a, b) => (b.reportingPct || 0) - (a.reportingPct || 0));
  } else if (currentSort === 'margin') {
    // compute leader margin and sort descending
    s.sort((a, b) => {
      const marginA = computeMargin(a);
      const marginB = computeMargin(b);
      return marginB - marginA;
    });
  }
  return s;
}

function computeMargin(state) {
  const total = state.candidates.reduce((sum,c)=>sum+c.votes,0);
  if (state.candidates.length < 2 || total === 0) return 0;
  const sorted = [...state.candidates].sort((a,b)=>b.votes-a.votes);
  return ((sorted[0].votes - sorted[1].votes) / total) * 100;
}

async function loadData() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch data');
  const json = await res.json();
  cache = json;
  lastFetch = new Date().toISOString();
  render();
}

function render() {
  if (!cache) return;
  const { race, candidates, states } = cache;
  const candidatesIndex = indexCandidates(candidates);
  els.raceTitle.textContent = race?.office ? `${race.office} Results` : 'Election Results';
  const nationalPct = race?.nationalReportingPct;
  els.reportingSummary.textContent = nationalPct != null ? `${fmtPercent(nationalPct)} reporting` : '';
  els.lastUpdated.textContent = `Updated ${timeAgo(race?.lastUpdated || lastFetch)}`;
  renderLeaderBoard(els.leaderRoot, candidates);
  const sortedStates = sortStates(states);
  renderStateTable(els.stateTbody, sortedStates, candidatesIndex);
  const selectedStateObj = states.find(s => s.code === selectedStateCode);
  renderDrilldown(els.stateDrill, selectedStateObj, candidatesIndex);
}

function attachEvents() {
  els.stateTbody.addEventListener('click', e => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    selectedStateCode = tr.dataset.state;
    render();
  });

  els.sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      render();
    });
  });
}

function startAutoRefresh() {
  if (timerId) clearInterval(timerId);
  timerId = setInterval(async () => {
    try {
      await loadData();
    } catch (e) {
      console.warn('Refresh failed', e);
    }
  }, REFRESH_MS);
}

(async function init() {
  attachEvents();
  try {
    await loadData();
    startAutoRefresh();
  } catch (e) {
    document.getElementById('app').innerHTML = `<p class="error">Failed to load data.</p>`;
    console.error(e);
  }
})();
