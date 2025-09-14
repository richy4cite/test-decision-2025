<<<<<<< Updated upstream
import { renderLeaderBoard, renderStateTable, renderDrilldown } from './render.js';
import { fmtPercent, timeAgo } from './format.js';
import { transformRaw } from './transform.js';

const DATA_URL = '2025-data.json'; // Correct root path
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
=======
import { timeAgo, fmtPercent } from './format.js';
import { transformRaw } from './transform.js';
import { renderLeaderBoard, renderStateTable, renderDrilldown } from './render.js';
import { augmentCandidates, leaderAndMargin } from './compute.js';

const DATA_URL = '2025-data.json';
const REFRESH_MS = 60_000;

const els = {
  lastUpdated: document.getElementById('last-updated'),
  nationalReporting: document.getElementById('national-reporting'),
  leaderboard: document.getElementById('leaderboard'),
  stateTbody: document.getElementById('state-tbody'),
  drilldown: document.getElementById('drilldown'),
  statusMessage: document.getElementById('status-message'),
  sortButtons: document.querySelectorAll('.sort-btn')
};

let model = null;
let candidatesIndex = new Map();
let sortMode = 'state';
let selectedStateCode = null;
let refreshTimer = null;

async function fetchData() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

function buildCandidatesIndex(candidates) {
  const map = new Map();
  for (const c of candidates) map.set(c.id, c);
>>>>>>> Stashed changes
  return map;
}

function sortStates(states) {
<<<<<<< Updated upstream
  const s = [...states];
  if (currentSort === 'state') {
    s.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === 'reporting') {
    s.sort((a, b) => (b.reportingPct || 0) - (a.reportingPct || 0));
  } else if (currentSort === 'margin') {
    s.sort((a, b) => computeMargin(b) - computeMargin(a));
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
  if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
  const raw = await res.json();
  cache = transformRaw(raw);
  lastFetch = new Date().toISOString();
  render();
}

function render() {
  if (!cache) return;
  const { race, candidates, states } = cache;
  const candidatesIndex = indexCandidates(candidates);
  els.raceTitle.textContent = race?.office || 'Election Results';
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
    document.getElementById('app').innerHTML = `<p class="error">Failed to load data. ${e.message}</p>`;
    console.error(e);
  }
})();
=======
  return [...states].sort((a, b) => {
    if (sortMode === 'state') {
      return a.name.localeCompare(b.name);
    } else if (sortMode === 'reporting') {
      return b.reportingPct - a.reportingPct;
    } else if (sortMode === 'margin') {
      const aLM = leaderAndMargin(a.candidates.map(c => candidatesIndex.get(c.id) || c)).marginPct;
      const bLM = leaderAndMargin(b.candidates.map(c => candidatesIndex.get(c.id) || c)).marginPct;
      return bLM - aLM;
    }
    return 0;
  });
}

function updateMeta() {
  if (!model) return;
  const { race, candidates } = model;
  els.lastUpdated.textContent = timeAgo(race.lastUpdated);
  els.nationalReporting.textContent = fmtPercent(race.nationalReportingPct);
  // Title attribute for exact
  els.lastUpdated.title = new Date(race.lastUpdated).toLocaleString();
}

function renderAll() {
  if (!model) return;
  candidatesIndex = buildCandidatesIndex(model.candidates);
  renderLeaderBoard(els.leaderboard, model.candidates);
  const sortedStates = sortStates(model.states);
  renderStateTable(els.stateTbody, sortedStates, candidatesIndex);
  const active = sortedStates.find(s => s.code === selectedStateCode);
  renderDrilldown(els.drilldown, active, candidatesIndex);
  updateMeta();
}

function setStatus(msg, isError = false) {
  if (!msg) {
    els.statusMessage.textContent = '';
    els.statusMessage.classList.remove('error');
    return;
  }
  els.statusMessage.textContent = msg;
  els.statusMessage.classList.toggle('error', isError);
}

async function loadInitial() {
  try {
    setStatus('Loading data...');
    const raw = await fetchData();
    model = transformRaw(raw);
    setStatus('');
    renderAll();
    scheduleRefresh();
  } catch (e) {
    console.error(e);
    setStatus('Failed to load data. Retry will occur on refresh.', true);
  }
}

async function refresh() {
  try {
    const raw = await fetchData();
    const newModel = transformRaw(raw);
    // Simple diff check by timestamp or candidate totals could be added here
    model = newModel;
    renderAll();
  } catch (e) {
    console.warn('Refresh failed:', e);
  } finally {
    scheduleRefresh();
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, REFRESH_MS);
}

function onSortClick(e) {
  const mode = e.currentTarget.getAttribute('data-sort');
  if (mode && mode !== sortMode) {
    sortMode = mode;
    els.sortButtons.forEach(btn => btn.classList.toggle('is-active', btn === e.currentTarget));
    renderAll();
  }
}

function onRowClick(e) {
  const tr = e.target.closest('tr');
  if (!tr || !tr.dataset.stateCode) return;
  selectedStateCode = tr.dataset.stateCode === selectedStateCode ? null : tr.dataset.stateCode;
  renderAll();
}

function attachEvents() {
  els.sortButtons.forEach(btn => btn.addEventListener('click', onSortClick));
  els.stateTbody.addEventListener('click', onRowClick);
}

attachEvents();
loadInitial();
>>>>>>> Stashed changes
