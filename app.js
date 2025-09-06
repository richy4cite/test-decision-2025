/* ===== Config ===== */
const AUTO_DEFAULT = 60000;
const ECJ_GEOJSON =
 'https://services6.arcgis.com/3R3y1KXaPJ9BFnsU/arcgis/rest/services/ECJWEB_MAP/FeatureServer/6/query?where=1%3D1&outFields=*&f=geojson';
const JAMAICA_BOUNDS = L.latLngBounds([17.6, -78.6], [18.6, -76.0]);

/* Party theming */
const PARTY_COLORS = { JLP:'#2e8b57', PNP:'#ff8c00', JPP:'#6a0dad', UIC:'#008b8b', Other:'#1e90ff' };
const PARTY_LOGOS = {
  JLP:"https://www.ecj.com.jm/wp-content/uploads/2025/03/JLP_logo-300x98.png",
  PNP:"https://www.ecj.com.jm/wp-content/uploads/2025/03/PNP_logo-300x182.png",
  JPP:"https://www.ecj.com.jm/wp-content/uploads/2025/03/JPP_logo-300x275.png",
  UIC:"https://www.ecj.com.jm/wp-content/uploads/2025/03/UIC_logo-300x164.png",
  Other:"https://static.vecteezy.com/system/resources/thumbnails/012/025/259/small_2x/jamaica-flag-with-grunge-texture-png.png"
};
const PARTY_SYMBOLS = {
  JLP:"https://ecj.com.jm/wp-content/uploads/2025/03/JLP_symbol.png",
  PNP:"https://www.ecj.com.jm/wp-content/uploads/2025/03/PNP_symbol.png",
  JPP:"https://www.ecj.com.jm/wp-content/uploads/2025/03/JPP_symbol-300x261.png",
  UIC:"https://www.ecj.com.jm/wp-content/uploads/2025/03/UIC_symbol-300x106.png",
  Other:"https://static.vecteezy.com/system/resources/thumbnails/012/025/259/small_2x/jamaica-flag-with-grunge-texture-png.png"
};
const CORE_PARTIES = ["JLP","PNP","JPP","UIC"];
const TICKER_MAX_AGE = 15*60*1000;
const SIDEBAR_MAX_AGE = 25*60*1000;

/* ===== Local data source ===== */
const DATA_URL = './2025-data.json';  // local file

/* ===== Normalizer + Name Aliases with metadata ===== */
function norm(s){ return String(s||'').toLowerCase().replace(/[\s\-\u2013\u2014'’.]/g,'').replace(/&/g,'and'); }
const NAME_ALIASES = {
  [norm('Kingston East and Port Royal')]: { key: norm('Kingston Eastern and Port Royal'), parish: 'KINGSTON', constno: '3' }
};
function canonKey(k){ return NAME_ALIASES[k]?.key || k; }

/* ===== State ===== */
let voteChart=null, seatChart=null, refreshTimer=null, timerInterval=null;
let mapNational=null, mapInteractive=null, geoLayerNational=null, geoLayerInteractive=null;
let baseLightNat=null, baseDarkNat=null, baseLightInt=null, baseDarkInt=null, currentBase='light';
let arcFeatures=[], byParish={}, constNameToNo={}, constNameToParish={};
let leaderColors = {}; let focusedKey = null; let pendingFocusName = null;
let lastSeats = JSON.parse(localStorage.getItem('lastSeats') || '{}');
let lastConstHashes = JSON.parse(localStorage.getItem('constituencyHashes')||'{}');
let lastConstUpdated = JSON.parse(localStorage.getItem('constituencyUpdated')||'{}');

/* Cached nodes for fast filtering (search/filters) without re-querying DOM */
let __CONST_NODES = [];
function cacheConstNodes(){
  __CONST_NODES = Array.from(document.querySelectorAll('.const'));
}

/* ===== Preview modal state ===== */
let previewMap=null, previewLayer=null, previewKey=null;

/* ===== Utils ===== */
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),4000); }
function contrastText(hex){ try{ const c=hex.replace('#',''); const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16); return ((r*299+g*587+b*114)/1000>=140)?'#0b1220':'#ffffff'; }catch{ return '#0b1220'; } }
function fmtHHMMSS(ms){ const s=Math.max(0,Math.floor(ms/1000)); const hh=String(Math.floor(s/3600)).padStart(2,'0'); const mm=String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${hh}:${mm}:${ss}`; }
// Debounce helper
function debounce(fn, delay=150){
  let t; 
  return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); };
}
function makeHash(cands){ return cands.map(k=>`${(k.Party||'Other').toUpperCase()}|${(k["First Name"]||'').trim()} ${(k["Last Name"]||'').trim()}|${Number(k.Votes||0)}`).join(';'); }
const partyKey = p => { const P = String(p||'Other').toUpperCase(); if (P.startsWith('INDA') || P.startsWith('INDB')) return 'Other'; return ['JLP','PNP','JPP','UIC'].includes(P) ? P : 'Other'; };
const bust = url => url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now();

/* ===== Theme toggle ===== */
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('modeBtn').textContent = theme==='dark' ? '🌙 Dark' : '🌞 Light';
  if (mapNational && baseLightNat && baseDarkNat){
    if (theme==='dark' && currentBase!=='dark'){ mapNational.removeLayer(baseLightNat); baseDarkNat.addTo(mapNational); currentBase='dark'; }
    if (theme==='light' && currentBase!=='light'){ mapNational.removeLayer(baseDarkNat); baseLightNat.addTo(mapNational); currentBase='light'; }
    setTimeout(()=>mapNational.invalidateSize(), 60);
  }
  if (mapInteractive && baseLightInt && baseDarkInt){
    if (theme==='dark'){ mapInteractive.removeLayer(baseLightInt); baseDarkInt.addTo(mapInteractive); }
    else { mapInteractive.removeLayer(baseDarkInt); baseLightInt.addTo(mapInteractive); }
    setTimeout(()=>mapInteractive.invalidateSize(), 60);
  }
}
function initTheme(){
  const saved = localStorage.getItem('theme') || 'light';
  applyTheme(saved);
  document.getElementById('modeBtn').addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme')==='dark' ? 'dark' : 'light';
    const next = cur==='dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });
}

/* ===== Tabs ===== */
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('section[id^="tab-"]').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('tab-'+t.dataset.tab).classList.remove('hidden');
  if (t.dataset.tab==='national' && mapNational) setTimeout(()=>mapNational.invalidateSize(), 60);
  if (t.dataset.tab==='interactive' && mapInteractive) {
    setTimeout(()=>mapInteractive.invalidateSize(), 60);
    if (pendingFocusName){ focusConstituencyByName(pendingFocusName, true); pendingFocusName=null; }
    else {
      const cur = document.getElementById('imapContent')?.dataset?.currentKey;
      if (cur) focusConstituencyByName(cur, true);
    }
  }
}));

/* ===== Sticky offsets ===== */
function updateStickyOffsets(){
  const hdr = document.getElementById('siteHeader');
  const tabs = document.getElementById('siteTabs');
  if (hdr){ document.documentElement.style.setProperty('--hdrh', hdr.offsetHeight+'px'); }
  if (tabs){ document.documentElement.style.setProperty('--tabh', tabs.offsetHeight+'px'); }
}
window.addEventListener('resize', updateStickyOffsets);

/* ===== Auto refresh ===== */
const sel = document.getElementById('refreshSel');
sel.value = localStorage.getItem('refreshIntervalMs') || String(AUTO_DEFAULT);
sel.addEventListener('change', ()=>{ localStorage.setItem('refreshIntervalMs', sel.value); setupAutoRefresh(); });
document.getElementById('btnForceRefresh').addEventListener('click', ()=>{ loadECJAndData(); });

/* ===== Maps ===== */
const JAMAICA_BOUNDS_LEAF = L.latLngBounds([17.6, -78.6], [18.6, -76.0]);
function initNationalMap(){
  if (mapNational) return;
  mapNational = L.map('mapContainer',{zoomControl:true, attributionControl:false, maxBounds:JAMAICA_BOUNDS_LEAF, maxBoundsViscosity:1});
  baseLightNat = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{minZoom:7, maxZoom:15});
  baseDarkNat  = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{minZoom:7, maxZoom:15});
  (document.documentElement.getAttribute('data-theme')==='dark' ? baseDarkNat : baseLightNat).addTo(mapNational);
  mapNational.fitBounds(JAMAICA_BOUNDS_LEAF);
  mapNational.setMinZoom(mapNational.getZoom());
  document.getElementById('btnResetNational').onclick = ()=>{
    mapNational.fitBounds(JAMAICA_BOUNDS_LEAF);
    mapNational.setMinZoom(mapNational.getZoom());
    setTimeout(()=> mapNational.invalidateSize(), 40);
  };
}
function initInteractiveMap(){
  if (mapInteractive) return;
  mapInteractive = L.map('imapMap',{zoomControl:true, attributionControl:false, maxBounds:JAMAICA_BOUNDS_LEAF, maxBoundsViscosity:1});
  baseLightInt = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{minZoom:7, maxZoom:15});
  baseDarkInt  = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{minZoom:7, maxZoom:15});
  (document.documentElement.getAttribute('data-theme')==='dark' ? baseDarkInt : baseLightInt).addTo(mapInteractive);
  mapInteractive.fitBounds(JAMAICA_BOUNDS_LEAF);
  mapInteractive.setMinZoom(mapInteractive.getZoom());
  document.getElementById('btnResetInteractive').onclick = ()=>{
    mapInteractive.fitBounds(JAMAICA_BOUNDS_LEAF);
    mapInteractive.setMinZoom(mapInteractive.getZoom());
    focusedKey = null; pendingFocusName = null;
    const cont = document.getElementById('imapContent');
    cont.textContent = 'Click a constituency to see results here.';
    cont.dataset.currentKey = '';
    if (geoLayerInteractive){
      geoLayerInteractive.eachLayer(l=>{
        try{ l.closeTooltip(); }catch(_){}
        const nm = l.feature?.properties?.CONST_NAME || '';
        const key = norm(nm);
        const fill = leaderColors[key] || '#e5e7eb';
        l.setStyle({ fillColor:fill, fillOpacity:0.75, color:'#94a3b8', weight:1 });
        stopPulse(l);
      });
    }
    setTimeout(()=> mapInteractive.invalidateSize(), 40);
  };
  window.addEventListener('resize', ()=> setTimeout(()=> mapInteractive.invalidateSize(), 40));
}
function buildLegendInto(containerId){
  const host=document.getElementById(containerId); if(!host) return;
  host.innerHTML='';
  ['JLP','PNP','JPP','UIC','Other'].forEach(p=>{
    const el=document.createElement('span'); el.className='legend-item';
    el.innerHTML=`<span class="swatch" style="background:${PARTY_COLORS[p]}"></span>${p}`;
    host.appendChild(el);
  });
}

/* ===== Boundaries ===== */
async function loadECJBoundaries(){
  const gj = await fetch(ECJ_GEOJSON, {cache:'no-store'}).then(r=>{ if(!r.ok) throw new Error('Boundaries HTTP '+r.status); return r.json(); });
  arcFeatures = gj.features || [];
  byParish = {}; constNameToNo={}; constNameToParish={};
  arcFeatures.forEach(f=>{
    const p=f.properties||{};
    const parish = p.PARISH_NAM || p.PARISH_NAME || '';
    const cname  = p.CONST_NAME || p.CONSTNAME || p.Name || '';
    const cno    = p.CONST_NO || p.CONSTNO || p.Number || '';
    const key=norm(cname);
    if (parish) (byParish[parish] ||= []);
    constNameToNo[key]=(cno||'').toString();
    constNameToParish[key]=parish||'';
  });
  Object.values(NAME_ALIASES).forEach(a=>{
    if (a.key){
      constNameToParish[a.key] = a.parish || constNameToParish[a.key] || '';
      constNameToNo[a.key]     = a.constno || constNameToNo[a.key] || '';
    }
  });
}

/* ===== Pulsing helpers ===== */
function startPulse(layer){
  if (!layer || layer._pulseTimer) return;
  let up=true;
  layer._pulseTimer = setInterval(()=>{
    const next = up ? 0.95 : 0.6; up=!up;
    layer.setStyle({ fillOpacity: next });
  }, 800);
}
function stopPulse(layer){
  if (layer && layer._pulseTimer){
    clearInterval(layer._pulseTimer);
    layer._pulseTimer = null;
    layer.setStyle({ fillOpacity:0.75 });
  }
}

/* ===== Topline / score / charts / closest ===== */
function buildToplineBar(totals,seats){
  const el=document.getElementById('toplineBar'); el.innerHTML='';
  const totalVotes=Object.values(totals).reduce((a,b)=>a+b,0)||1;
  const deltas={}; ['JLP','PNP','JPP','UIC','Other'].forEach(p=>{ const prev=lastSeats?.[p]||0; const cur=seats[p]||0; deltas[p]=cur-prev; });
  localStorage.setItem('lastSeats', JSON.stringify(seats)); lastSeats=seats;
  ['JLP','PNP','JPP','UIC','Other'].forEach(p=>{
    const votes=totals[p]||0, s=seats[p]||0; const pct=((votes/(totalVotes||1))*100).toFixed(1); const d=deltas[p]||0;
    const deltaHtml = d?`<span class="delta ${d>0?'up':'down'}">${d>0?'▲':'▼'} ${Math.abs(d)}</span>`:'';
    const card=document.createElement('div'); card.className='tcard';
    card.innerHTML = `<img class="tlogo" src="${PARTY_LOGOS[p]}" alt="${p} logo" referrerpolicy="no-referrer">
      <div class="tstats"><b>${s}</b> seats ${deltaHtml} &nbsp;|&nbsp; <b>${votes.toLocaleString()}</b> votes &nbsp;|&nbsp; <b>${pct}%</b></div>`;
    el.appendChild(card);
  });
}
function buildScoreboard(totals,seats){
  const el=document.getElementById('scoreboard'); if(!el) return; el.innerHTML='';
  const totalVotes=Object.values(totals).reduce((a,b)=>a+b,0)||1;
  const prev = JSON.parse(localStorage.getItem('lastSeats')||'{}');
  [{key:'JLP', name:'Jamaica Labour Party', color:PARTY_COLORS.JLP, logo:PARTY_LOGOS.JLP},
   {key:'PNP', name:'People’s National Party', color:PARTY_COLORS.PNP, logo:PARTY_LOGOS.PNP},
   {key:'Other', name:'Others (JPP, UIC, etc.)', color:PARTY_COLORS.Other, logo:PARTY_LOGOS.Other}].forEach(g=>{
    const votes=totals[g.key]||0, s=seats[g.key]||0, pct=((votes/(totalVotes||1))*100).toFixed(1);
    const delta=s-(prev?.[g.key]||0);
    const deltaHtml = delta?`<span class="delta ${delta>0?'up':'down'}">${delta>0?'▲':'▼'} ${Math.abs(delta)}</span>`:'';
    const div=document.createElement('div'); div.className='pcard';
    div.innerHTML = `
      <div class="phead">
        <div class="pbrand" style="color:${g.color}">
          <img class="plogo" src="${g.logo}" alt="${g.key} logo" referrerpolicy="no-referrer">
          <strong>${g.name}</strong>
        </div>
        <div class="pmain" style="color:${g.color}">${pct}%</div>
      </div>
      <div class="bar"><span style="width:${pct}%; background:${g.color}"></span></div>
      <div style="margin-top:8px; color:var(--muted)"><b>${s}</b> seats ${deltaHtml} &nbsp;|&nbsp; Votes: ${votes.toLocaleString()}</div>`;
    el.appendChild(div);
  });
}
function buildCharts(totals,seats){
  const vc=document.getElementById('voteChart'), sc=document.getElementById('seatChart');
  try{ voteChart && voteChart.destroy(); }catch(_){}
  try{ seatChart && seatChart.destroy(); }catch(_){}
  const labels=Object.keys(totals); if(!labels.length) return;
  const colors=labels.map(p=>PARTY_COLORS[p]||PARTY_COLORS.Other);
  voteChart=new Chart(vc,{type:'pie',data:{labels,datasets:[{data:labels.map(k=>totals[k]||0),backgroundColor:colors}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});
  seatChart=new Chart(sc,{type:'bar',data:{labels,datasets:[{label:'Seats',data:labels.map(k=>seats[k]||0),backgroundColor:colors}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,precision:0,grid:{color:'rgba(148,163,184,.3)'}}}}});
}
function buildClosestPanel(items){
  const list=document.getElementById('closestList'), note=document.getElementById('closestNote'); if(!list) return;
  list.innerHTML='';
  const top10 = items.filter(x=>!isNaN(x.marginPct)).sort((a,b)=>a.marginPct-b.marginPct).slice(0,10);
  top10.forEach(item=>{
    const color=PARTY_COLORS[partyKey(item.winnerParty)]||PARTY_COLORS.Other;
    const li=document.createElement('li');
    li.innerHTML = `<span><strong>${item.constituency}</strong> — <span style="color:${color}">${item.winnerFirst} ${item.winnerLast} (${partyKey(item.winnerParty)})</span></span><span><strong>${item.marginPct.toFixed(1)}%</strong></span>`;
    li.title = item.candidates.map(c=>`${c.name} (${partyKey(c.party)}): ${c.votes.toLocaleString()} • ${c.pct}%`).join(' | ');
    li.addEventListener('click', ()=> gotoInteractive(item.constituency));
    list.appendChild(li);
  });
  note.textContent='Margin = percentage-point gap between 1st and 2nd.';
}

/* ===== Map coloring & interactions ===== */
function paintMap(layer, detailsByConst){
  if (!layer) return;
  layer.eachLayer(Ly=>{
    const nm = Ly.feature?.properties?.CONST_NAME || '';
    const key = norm(nm);
    const info = detailsByConst[key];
    if (info){
      const fill = PARTY_COLORS[partyKey(info.party)] || PARTY_COLORS.Other;
      leaderColors[key]=fill;
      const strokeWeight = (focusedKey && focusedKey===key) ? 3 : 1;
      const strokeColor  = (focusedKey && focusedKey===key) ? '#111827' : '#94a3b8';
      Ly.setStyle({ fillColor: fill, fillOpacity:0.75, color:strokeColor, weight:strokeWeight });
      const disp = `${nm}${constNameToNo[key]?` (#${constNameToNo[key]})`:''}`;
      const rows = (info.all||[]).map(c=>{
        const P=partyKey(c.party), col=PARTY_COLORS[P]||PARTY_COLORS.Other;
        return `<div><span style="color:${col}; font-weight:700">${c.name}</span> (${P}) — ${c.votes.toLocaleString()} • ${c.pct}%</div>`;
      }).join('');
      Ly.bindTooltip(`<div style="min-width:260px"><div style="font-weight:800;margin-bottom:4px">${disp}</div>${rows}</div>`, {sticky:true});
    }else{
      Ly.setStyle({ fillColor:'#e5e7eb', fillOpacity:0.6, color:'#94a3b8', weight:1 });
      Ly.bindTooltip(`<div><strong>${nm}</strong><br/><span style="color:#d1d5db">No result yet.</span></div>`, {sticky:true});
    }
  });
}
function updateFocusOutline(){
  if (!geoLayerInteractive) return;
  geoLayerInteractive.eachLayer(l=>{
    const nm = l.feature?.properties?.CONST_NAME || '';
    const key = norm(nm);
    const fill = leaderColors[key] || '#e5e7eb';
    const isFocused = focusedKey && focusedKey===key;
    l.setStyle({ fillColor: fill, fillOpacity:0.75, color: isFocused? '#111827':'#94a3b8', weight: isFocused? 3:1 });
    if (isFocused){ try{ l.bringToFront(); }catch(_){}
      startPulse(l);
    } else {
      stopPulse(l);
    }
  });
}
function wireInteractiveBehaviors(){
  const hoverTimers = new WeakMap();
  byParish = {};
  geoLayerInteractive.eachLayer(l=>{
    const parish = l.feature?.properties?.PARISH_NAM;
    (byParish[parish] ||= []).push(l);
  });
  geoLayerInteractive.eachLayer(layer=>{
    const nm = layer.feature?.properties?.CONST_NAME || '';
    const parish = layer.feature?.properties?.PARISH_NAM || '';
    const key = norm(nm);
    layer.on('click', ()=>{
      const grp = byParish[parish] || [layer];
      const group = L.featureGroup(grp);
      try{ mapInteractive.fitBounds(group.getBounds(), {padding:[10,10]}); }catch(e){}
      focusedKey = key; updateFocusOutline();
      showConstituencyDetails(key, nm);
    });
    layer.on('mouseover', e=>{
      const t = setTimeout(()=>{ e.target.openTooltip(); }, 800);
      hoverTimers.set(layer, t);
      e.target.setStyle({ weight: (focusedKey===key? 3:2), color:'#111827', fillOpacity:0.9 }); e.target.bringToFront();
    });
    layer.on('mouseout', e=>{
      clearTimeout(hoverTimers.get(layer));
      e.target.closeTooltip();
      const fill = leaderColors[key] || '#e5e7eb';
      const wt = (focusedKey===key)? 3 : 1;
      const col = (focusedKey===key)? '#111827' : '#94a3b8';
      e.target.setStyle({ fillColor: fill, fillOpacity:0.75, color: col, weight: wt });
    });
  });
}

/* ===== Details panel ===== */
function showConstituencyDetails(normKey, featureName){
  const cont=document.getElementById('imapContent');
  cont.dataset.currentKey = normKey;
  const block = document.querySelector(`.const[data-key="${normKey}"]`);
  if (!block){ cont.textContent='No data found.'; return; }
  const rows = JSON.parse(block.dataset.candidates || '[]');
  const updated = block.dataset.updated ? Number(block.dataset.updated) : null;
  const cNo = block.dataset.constno ? ` (#${block.dataset.constno})` : '';

  const ageMs = Date.now() - (updated||Date.now());
  let dotColor = 'var(--bad)';
  if (ageMs <= 5*60*1000) dotColor = 'var(--good)';
  else if (ageMs <= 20*60*1000) dotColor = 'var(--warn)';

  const dispName = featureName + cNo;
  const boxStr = block.dataset.boxes || '';
  const boxPct = block.dataset.boxpct || '';

  let html = `<h3 style="margin:4px 0">${dispName}</h3>`;
  html += `
    <div class="updated">
      <span>Last updated:</span>
      <span><span class="pulse" style="color:${dotColor}"></span>
        <span style="font-variant-numeric:tabular-nums">${fmtHHMMSS(Date.now()-(updated||Date.now()))}</span> ago
      </span>
    </div>
    ${boxStr ? `<div class="boxline">Boxes counted: <strong>${boxStr}</strong>${boxPct?` (${boxPct}%)`:''}</div>` : ''}
  `;
  html += `<table style="width:100%; border-collapse:collapse; margin-top:6px"><thead><tr><th style="width:28px"></th><th>Candidate</th><th>Party</th><th style="text-align:right">Votes</th><th style="text-align:right">%</th></tr></thead><tbody>`;
  rows.forEach(r=>{
    const P = partyKey(r.party);
    const icon = PARTY_SYMBOLS[P] || PARTY_SYMBOLS.Other;
    const nameStyle = `style="color:${PARTY_COLORS[P]||PARTY_COLORS.Other}; font-weight:700"`;
    html += `<tr>
      <td><img src="${icon}" alt="${P}" class="party-icon" referrerpolicy="no-referrer"></td>
      <td ${nameStyle}>${r.name}</td>
      <td>${P}</td>
      <td style="text-align:right; font-weight:800">${Number(r.votes||0).toLocaleString()}</td>
      <td style="text-align:right">${r.pct||0}%</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  cont.innerHTML = html;
}

/* ===== Render parish blocks + filters + SORT ===== */
function renderParishBlocks(detailsByConst, rawData){
  const host=document.getElementById('parishContainer'); host.innerHTML='';
  const parishSel = document.getElementById('parishFilter');
  const partySel  = document.getElementById('partyFilter');
  const cnoInp    = document.getElementById('cnoFilter');
  const sortField = document.getElementById('sortField').value;
  const sortDir   = document.getElementById('sortDir').value;

  const allKeys = Object.keys(detailsByConst);
  const parishOf = k => constNameToParish[k] || '';
  const cnoOf    = k => (constNameToNo[k] || '');
  const recOf    = k => Object.values(rawData).find(x=> canonKey(norm(x?.Name))===k);
  const nameOf   = k => (recOf(k)?.Name || k);
  const leadPartyOf = k => detailsByConst[k]?.all?.[0]?.party || 'Other';

  const parishSet = new Set(allKeys.map(parishOf));
  let parishes = Array.from(parishSet).sort((a,b)=> a.localeCompare(b));
  if (sortField==='parish') parishes.sort((a,b)=> sortDir==='asc'? a.localeCompare(b):b.localeCompare(a));

  const curParish = parishSel.value;
  parishSel.innerHTML = `<option value="">All Parishes</option>` + parishes.map(p=>`<option ${curParish===p?'selected':''} value="${p}">${p}</option>`).join('');

  const filterParish = parishSel.value;
  const filterParty  = partySel.value;
  const filterCno    = cnoInp.value.trim();

  parishes.forEach(parish=>{
    if (filterParish && parish!==filterParish) return;
    let keys = allKeys.filter(k=> parishOf(k)===parish);

    keys.sort((ka,kb)=>{
      let A,B;
      switch (sortField){
        case 'cno':   A=Number(cnoOf(ka)||0); B=Number(cnoOf(kb)||0); break;
        case 'name':  A=nameOf(ka).toLowerCase(); B=nameOf(kb).toLowerCase(); break;
        case 'party': A=leadPartyOf(ka); B=leadPartyOf(kb); break;
        case 'parish':A=parishOf(ka); B=parishOf(kb); break;
        default: A=nameOf(ka).toLowerCase(); B=nameOf(kb).toLowerCase();
      }
      if (A<B) return sortDir==='asc'?-1:1;
      if (A>B) return sortDir==='asc'? 1:-1;
      return 0;
    });

    const wrap=document.createElement('div'); wrap.className='parish';
    wrap.innerHTML = `<h2>${parish||'—'}</h2><div class="const-grid"></div>`;
    const grid = wrap.querySelector('.const-grid');

    keys.forEach(key=>{
      const info = detailsByConst[key];
      const record = recOf(key);
      const origName = record?.Name || key;
      const cNo = constNameToNo[key] || '';

      if (filterParty && !info.all.some(c=> partyKey(c.party)===filterParty)) return;
      if (filterCno && !String(cNo).startsWith(filterCno)) return;

      const winnerParty = partyKey(info.all?.[0]?.party || 'Other');
      const winnerObj = info.all?.[0] || null;

      const bg = PARTY_COLORS[winnerParty] || PARTY_COLORS.Other;
      const textColor = contrastText(bg);
      const candidatesPayload = JSON.stringify(info.all || []);
      const updatedTs = lastConstUpdated[key] || '';

      // Boxes declare rule: declare only full or >=95%
      let boxes = '', boxpct = ''; let fullCounted=false, pctNum=0, canDeclare=false;
      if (record?.Data){
        const d = Array.isArray(record.Data)? record.Data[0] : record.Data;
        boxes  = d?.["Boxes Counted"] || '';
        boxpct = (d?.["Box Counted Percentage"]!=null) ? String(d["Box Counted Percentage"]) : '';
        const m = boxes ? String(boxes).match(/(\d+)\s*of\s*(\d+)/i) : null;
        if (m){ const counted=+m[1], total=+m[2]; fullCounted = total>0 && counted===total; }
        pctNum = Number(boxpct)||0;
        canDeclare = fullCounted || (pctNum>=95);
      }

      const el=document.createElement('div'); el.className='const';
      el.dataset.key = key;
      el.dataset.constno = cNo;
      el.dataset.updated = updatedTs;
      el.dataset.candidates = candidatesPayload;
      el.dataset.boxes = boxes;
      el.dataset.boxpct = boxpct;

      el.dataset.search = [origName, cNo, parish, ...(info.all||[]).map(c=>`${c.name} ${partyKey(c.party)}`)].join(' ').toLowerCase();
      el.dataset.parish = parish;
      el.dataset.parties = (info.all||[]).map(c=>partyKey(c.party)).join('|');
      el.dataset.cno = cNo;

      el.style.borderColor = bg;
      el.style.setProperty('--win', bg);

      const ageMs = Date.now() - (updatedTs||Date.now());
      let dotColor = 'var(--bad)';
      if (ageMs <= 5*60*1000) dotColor = 'var(--good)';
      else if (ageMs <= 20*60*1000) dotColor = 'var(--warn)';

      const niceName = `${origName} ${cNo?`(#${cNo})`:''}`;

      const winnerBadgeHTML = (canDeclare && winnerObj)
        ? `<div class="winner-badge" style="background:${bg}; color:${textColor}; border-color:${bg}">
             <span class="check">✓</span> ${winnerObj.name} (${winnerParty})
           </div>`
        : (winnerObj
           ? `<div class="winner-badge" style="background:var(--card); color:var(--text); border-color:var(--border)">
                Leading: <strong style="color:${PARTY_COLORS[winnerParty]||'#888'}">${winnerObj.name} (${winnerParty})</strong>
              </div>`
           : ``);

      const rowsHTML = (info.all||[]).map(c=>{
        const P=partyKey(c.party), icon=PARTY_SYMBOLS[P]||PARTY_SYMBOLS.Other;
        const nameStyle = `style="color:${PARTY_COLORS[P]||PARTY_COLORS.Other}"`;
        return `<div class="row">
          <img class="party-icon" src="${icon}" alt="${P}" referrerpolicy="no-referrer">
          <div class="nm" ${nameStyle}>${c.name}</div>
          <div class="party">${P}</div>
          <div class="votes">${Number(c.votes||0).toLocaleString()}</div>
          <div class="pct">${c.pct||0}%</div>
        </div>`;
      }).join('');

      el.innerHTML = `
        <div class="const-head">
          <div class="const-name">${niceName}</div>
          <span class="updated">
            <span>Last updated:</span>
            <span><span class="pulse" style="color:${dotColor}"></span>
              <span class="timer" data-ts="${updatedTs||''}" style="font-variant-numeric:tabular-nums">
                ${fmtHHMMSS(Date.now()-(updatedTs||Date.now()))}
              </span> ago
            </span>
          </span>
        </div>
        <div class="const-body">
          ${winnerBadgeHTML}
          ${boxes? `<div class="boxline">Boxes counted: <strong>${boxes}</strong>${boxpct?` (${boxpct}%)`:''}</div>` : ''}
          <div class="rows">${rowsHTML}</div>
        </div>
      `;
      // OPEN PREVIEW (first click)
      el.addEventListener('click', ()=> openPreviewForKey(key));
      grid.appendChild(el);
    });

    if (grid.children.length) document.getElementById('parishContainer').appendChild(wrap);
  });

  // Text search (fast: cached nodes + debounced input)
  const sb = document.getElementById('searchBar');
  function applyTextFilter(){
    const q = sb.value.trim().toLowerCase();
    let anyVisible = false;
    window.requestAnimationFrame(()=>{
      __CONST_NODES.forEach(card=>{
        const hit = !q || (card.dataset.search || '').includes(q);
        card.style.display = hit ? '' : 'none';
        if (hit) anyVisible = true;
      });
      document.querySelectorAll('.parish').forEach(p=>{
        const vis = Array.from(p.querySelectorAll('.const')).some(x=> x.style.display!=='none');
        p.style.display = vis ? '' : 'none';
      });
      const host = document.getElementById('parishContainer');
      const empty = document.getElementById('emptyMsg');
      if (!anyVisible){
        if (!empty){
          host.insertAdjacentHTML('beforeend',
            '<div id="emptyMsg" class="card" style="padding:16px; color:var(--muted)">No results — try clearing filters or search.</div>');
        }
      } else {
        if (empty) empty.remove();
      }
    });
  }
  sb.oninput = debounce(applyTextFilter, 150);
}

/* ===== Fast facet filters (parish/party/#) — no rebuild ===== */
function applyFacetFilters(){
  const parishSelVal = document.getElementById('parishFilter').value;
  const partySelVal  = document.getElementById('partyFilter').value;
  const cnoVal       = document.getElementById('cnoFilter').value.trim();

  window.requestAnimationFrame(()=>{
    __CONST_NODES.forEach(card=>{
      const parishOk = !parishSelVal || card.dataset.parish === parishSelVal;
      const partyOk  = !partySelVal || (card.dataset.parties || '').split('|').includes(partySelVal);
      const cnoOk    = !cnoVal || (card.dataset.cno || '').startsWith(cnoVal);
      const show     = parishOk && partyOk && cnoOk;
      card.style.display = show ? '' : 'none';
    });

    document.querySelectorAll('.parish').forEach(p=>{
      const vis = Array.from(p.querySelectorAll('.const')).some(x=> x.style.display!=='none');
      p.style.display = vis ? '' : 'none';
    });
  });
}

/* ===== Periodic timers + sidebar + ticker ===== */
function fmtAgeToClass(age){
  if (age <= 5*60*1000) return 'age-good';
  if (age <= 20*60*1000) return 'age-warn';
  return 'age-bad';
}
function tickTimersAndRecent(){
  document.querySelectorAll('.const .timer').forEach(t=>{
    const ts = Number(t.dataset.ts||0);
    if (!ts) { t.textContent = '00:00:00'; return; }
    const age = Date.now()-ts;
    t.textContent = fmtHHMMSS(age);
    const dot = t.parentElement?.querySelector('.pulse');
    if (dot){
      let col='var(--bad)';
      if (age <= 5*60*1000) col='var(--good)';
      else if (age <= 20*60*1000) col='var(--warn)';
      dot.style.color = col;
    }
  });

  const recents = []; const ticker  = [];
  Object.keys(lastConstUpdated).forEach(k=>{
    const ts = lastConstUpdated[k];
    const age = Date.now()-ts;
    const name = Object.values(window.__rawData||{}).find(x=> canonKey(norm(x?.Name))===k)?.Name || k;
    const num = constNameToNo[k] || '';
    if (ts && age <= SIDEBAR_MAX_AGE) recents.push({k, name, num, ts, age});
    if (ts && age <= TICKER_MAX_AGE)  ticker.push({k, name, num, ts, age});
  });
  recents.sort((a,b)=> b.ts - a.ts);
  ticker.sort((a,b)=> b.ts - a.ts);

  const side = document.getElementById('sidebarList');
  side.innerHTML='';
  recents.forEach(r=>{
    const el=document.createElement('div');
    el.className='sideitem '+fmtAgeToClass(r.age);
    el.dataset.key = r.k;
    el.innerHTML=`<span>#${r.num||'—'}</span><small>${fmtHHMMSS(r.age)}</small>`;
    el.addEventListener('click', ()=> gotoInteractiveKey(r.k));
    side.appendChild(el);
  });

  const tick = document.getElementById('tickerText');
  if (ticker.length){
    const parts = ticker.map(r=> `${r.name}${r.num?` (#${r.num})`:''} — ${fmtHHMMSS(Date.now()-r.ts)} ago`);
    tick.textContent = '   •   ' + parts.join('   •   ') + '   •   ';
  }else{
    tick.textContent = '— No constituency updated in the last 15 minutes —';
  }

  const imTimer = document.querySelector('#imapContent .updated span[style*="font-variant-numeric"]');
  const imDot   = document.querySelector('#imapContent .updated .pulse');
  const curKey = document.getElementById('imapContent')?.dataset?.currentKey;
  if (imTimer && curKey && lastConstUpdated[curKey]){
    const age = Date.now()-lastConstUpdated[curKey];
    imTimer.textContent = fmtHHMMSS(age);
    if (imDot){
      let col='var(--bad)'; if (age<=5*60*1000) col='var(--good)'; else if (age<=20*60*1000) col='var(--warn)';
      imDot.style.color = col;
    }
  }
}

/* ===== Robust fetch helper ===== */
async function fetchOne(url){
  try{
    const r = await fetch(bust(url), {cache:'no-store'});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!/json/i.test(ct)) {
      try { return await r.json(); } catch { throw new Error(`Non-JSON content-type: ${ct}`); }
    }
    return await r.json();
  }catch(e){ throw new Error(`${url} → ${e.message}`); }
}

/* ===== Data load (local JSON) ===== */
async function loadECJAndData(){
  try{
    if (!arcFeatures.length){ try{ await loadECJBoundaries(); }catch(_){ toast('Could not load boundaries.'); } }
    initNationalMap(); initInteractiveMap();
    buildLegendInto('mapLegend'); buildLegendInto('imapLegend');

    const data = await fetchOne(DATA_URL);
    window.__rawData = data;

    if (!geoLayerNational){
      geoLayerNational = L.geoJSON({type:'FeatureCollection', features: arcFeatures},{ style:()=>({ color:'#94a3b8', weight:1, fillColor:'#e5e7eb', fillOpacity:0.6 })}).addTo(mapNational);
    }
    if (!geoLayerInteractive){
      geoLayerInteractive = L.geoJSON({type:'FeatureCollection', features: arcFeatures},{ style:()=>({ color:'#94a3b8', weight:1, fillColor:'#e5e7eb', fillOpacity:0.6 })}).addTo(mapInteractive);
    }

    const partyTotals={JLP:0, PNP:0, JPP:0, UIC:0, Other:0};
    const partySeats ={JLP:0, PNP:0, JPP:0, UIC:0, Other:0};
    const detailsByConst={}, closestArr=[];
    Object.values(data).forEach(c=>{
      const cname=c?.Name||''; const cData=Array.isArray(c?.Data)? c.Data[0] : c?.Data;
      const cand = Array.isArray(cData?.Candidates)? cData.Candidates : [];
      if(!cname || !cand.length) return;
      let key = canonKey(norm(cname));
      const alias = NAME_ALIASES[norm(cname)];
      if (alias){
        constNameToParish[key] = alias.parish || constNameToParish[key] || '';
        constNameToNo[key]     = alias.constno || constNameToNo[key] || '';
      }

      const safePct  = (x)=> Number(x)||0;
      const safeVote = (x)=> Number(x)||0;
      const winner = cand.reduce((m,x)=> safeVote(x.Votes)>safeVote(m.Votes)? x : m, cand[0]);
      const sorted = cand.slice().sort((a,b)=> safePct(b.Percentage)-safePct(a.Percentage)).map(k=>({
        name:`${(k["First Name"]||'').trim()} ${(k["Last Name"]||'').trim()}`.trim(),
        party:partyKey(k.Party),
        votes:safeVote(k.Votes),
        pct:safePct(k.Percentage)
      }));

      const sig = makeHash(cand);
      if (lastConstHashes[key] !== sig){
        lastConstHashes[key] = sig;
        lastConstUpdated[key] = Date.now();
        localStorage.setItem('constituencyHashes', JSON.stringify(lastConstHashes));
        localStorage.setItem('constituencyUpdated', JSON.stringify(lastConstUpdated));
      }

      detailsByConst[key] = { party:partyKey(winner?.Party), all: sorted };
      cand.forEach(k=>{ const p=partyKey(k.Party); partyTotals[p]=(partyTotals[p]||0)+safeVote(k.Votes); });
      const wParty = partyKey(winner?.Party);
      partySeats[wParty] = (partySeats[wParty] ?? 0) + 1;

      const topPct = sorted[0]?.pct||0, runnerPct=sorted[1]?.pct||0;
      closestArr.push({
        constituency:cname,
        winnerFirst: sorted[0]?.name.split(' ')[0]||'',
        winnerLast:  (sorted[0]?.name.split(' ').slice(1).join(' '))||'',
        winnerParty: sorted[0]?.party||'Other',
        marginPct: Math.max(0,(topPct-runnerPct)),
        candidates: sorted
      });
    });

    const {totals: groupedTotals, seats: groupedSeats} = groupSmallParties(partyTotals, partySeats, 0.02, Object.keys(PARTY_COLORS));

    buildToplineBar(groupedTotals, groupedSeats);
    buildScoreboard(groupedTotals, groupedSeats);
    buildCharts(groupedTotals, groupedSeats);
    buildClosestPanel(closestArr);
    renderParishBlocks(detailsByConst, data);
    paintMap(geoLayerNational, detailsByConst);
    paintMap(geoLayerInteractive, detailsByConst);
    wireInteractiveBehaviors();
    updateFocusOutline();

    document.getElementById('lastUpdated').textContent = "Live • " + new Date().toLocaleTimeString();

    // Cache nodes after rendering for fast filters/search
    cacheConstNodes();

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tickTimersAndRecent, 1000);
    tickTimersAndRecent();
  }catch(e){ console.error(e); toast('Partial update — check console.'); }
}
function groupSmallParties(totals,seats,threshold=0.02, keep=[]){
  const baseKeys = Array.from(new Set([...keep, 'Other', 'JLP','PNP','JPP','UIC']));
  const total = Object.values(totals).reduce((a,b)=>a+b,0) || 1;
  const T = Object.fromEntries(baseKeys.map(k=>[k,0]));
  const S = Object.fromEntries(baseKeys.map(k=>[k,0]));
  for (const p of Object.keys(totals)){
    const share = totals[p] / total;
    const bucket = (!keep.includes(p) && p!=='Other' && share < threshold) ? 'Other' : p;
    T[bucket] = (T[bucket] || 0) + (totals[p] || 0);
    S[bucket] = (S[bucket] || 0) + (seats[p]  || 0);
  }
  if (T.Other == null) T.Other = 0;
  if (S.Other == null) S.Other = 0;
  return {totals:T, seats:S};
}

/* ===== Deep link + handshake ===== */
function gotoInteractive(name){
  let k = norm(name);
  const alias = NAME_ALIASES[k];
  const resolved = alias?.key || k;
  document.querySelectorAll('section[id^="tab-"]').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelector('.tab[data-tab="interactive"]').classList.add('active');
  document.getElementById('tab-interactive').classList.remove('hidden');

  if (!geoLayerInteractive){ pendingFocusName = resolved; return; }
  focusConstituencyByName(resolved, true);
  setTimeout(()=> mapInteractive.invalidateSize(), 80);
  document.getElementById('imapDetails').scrollIntoView({behavior:'smooth', block:'start'});
}
function gotoInteractiveKey(key){
  document.querySelectorAll('section[id^="tab-"]').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelector('.tab[data-tab="interactive"]').classList.add('active');
  document.getElementById('tab-interactive').classList.remove('hidden');

  if (!geoLayerInteractive){ pendingFocusName = key; return; }
  focusConstituencyByName(key, true);
  setTimeout(()=> mapInteractive.invalidateSize(), 80);
  document.getElementById('imapDetails').scrollIntoView({behavior:'smooth', block:'start'});
}
function focusConstituencyByNumber(no){
  if (!geoLayerInteractive) return false;
  let found=null, parish=null, display=null, key=null;
  geoLayerInteractive.eachLayer(L=>{
    const p = L.feature?.properties||{};
    const n = String(p.CONST_NO || p.CONSTNO || p.Number || '');
    if (n === String(no)){
      found=L; parish=p.PARISH_NAM; display=p.CONST_NAME; key=norm(p.CONST_NAME||'');
    }
  });
  if (!found) return false;
  const grp=[]; geoLayerInteractive.eachLayer(l=>{ if (l.feature?.properties?.PARISH_NAM===parish) grp.push(l); });
  const group = L.featureGroup(grp.length? grp:[found]);
  try{ mapInteractive.fitBounds(group.getBounds(), {padding:[10,10]}); }catch(e){}
  focusedKey = key; updateFocusOutline();
  setTimeout(()=> found.openTooltip(), 250);
  showConstituencyDetails(key, display||`#${no}`);
  return true;
}
function focusConstituencyByName(nameOrKey, isKey=false){
  if (!geoLayerInteractive) return;
  const rawK = isKey ? nameOrKey : norm(nameOrKey);
  const alias = NAME_ALIASES[rawK];
  const keyWanted = alias?.key || rawK;

  let target=null, parish=null, display=null;
  geoLayerInteractive.eachLayer(L=>{
    const nm = L.feature?.properties?.CONST_NAME || '';
    const k = norm(nm);
    if (k===keyWanted){ target=L; parish = L.feature?.properties?.PARISH_NAM; display=nm; }
  });

  if (target){
    const grp = (function(){ const arr=[]; geoLayerInteractive.eachLayer(l=>{ if (l.feature?.properties?.PARISH_NAM===parish) arr.push(l); }); return arr; })();
    const group = L.featureGroup(grp.length? grp:[target]);
    try{ mapInteractive.fitBounds(group.getBounds(), {padding:[10,10]}); }catch(e){}
    focusedKey = keyWanted; updateFocusOutline();
    startPulse(target);
    setTimeout(()=> target.openTooltip(), 250);
    showConstituencyDetails(keyWanted, display||nameOrKey);
  } else {
    const number = constNameToNo[keyWanted] || constNameToNo[alias?.key || ''];
    if (number && focusConstituencyByNumber(number)) return;
    setTimeout(()=> focusConstituencyByName(nameOrKey, isKey), 150);
  }
}

/* ===== Preview modal logic ===== */
function initPreviewMap(){
  if (previewMap) return;
  previewMap = L.map('previewMap', { zoomControl:true, attributionControl:false, maxBounds:JAMAICA_BOUNDS, maxBoundsViscosity:1 });
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  L.tileLayer(isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {minZoom:7, maxZoom:15}).addTo(previewMap);
  previewMap.fitBounds(JAMAICA_BOUNDS);
  previewMap.setMinZoom(previewMap.getZoom());
}
function closePreview(){
  const modal = document.getElementById('previewModal');
  modal.classList.remove('show');
  document.body.classList.remove('modal-open');
  if (previewLayer){
    try{
      previewLayer.eachLayer(stopPulse);
      previewLayer.remove();
    }catch(_){}
    previewLayer=null;
  }
  const shim = document.getElementById('previewShimmer');
  if (shim) shim.style.display='none';
}
function populatePreviewDetails(key){
  const tbody = document.getElementById('previewTableBody');
  const boxes = document.getElementById('previewBoxes');
  tbody.innerHTML='';
  boxes.textContent='';
  const block = document.querySelector(`.const[data-key="${key}"]`);
  if (!block) return;
  const rows = JSON.parse(block.dataset.candidates || '[]');
  const boxStr = block.dataset.boxes || '';
  const boxPct = block.dataset.boxpct || '';
  if (boxStr) boxes.innerHTML = `Boxes counted: <strong>${boxStr}</strong>${boxPct?` (${boxPct}%)`:''}`;
  rows.forEach(r=>{
    const P = partyKey(r.party);
    const icon = PARTY_SYMBOLS[P] || PARTY_SYMBOLS.Other;
    const nameStyle = `style="color:${PARTY_COLORS[P]||PARTY_COLORS.Other}; font-weight:700"`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${icon}" alt="${P}" class="party-icon" referrerpolicy="no-referrer"></td>
      <td ${nameStyle}>${r.name}</td>
      <td>${P}</td>
      <td style="text-align:right; font-variant-numeric:tabular-nums; font-weight:800">${Number(r.votes||0).toLocaleString()}</td>
      <td style="text-align:right">${r.pct||0}%</td>
    `;
    tbody.appendChild(tr);
  });
}
function openPreviewForKey(key){
  previewKey = key;
  const modal = document.getElementById('previewModal');
  modal.classList.add('show');
  document.body.classList.add('modal-open');

  initPreviewMap();
  const shim = document.getElementById('previewShimmer');
  if (shim) shim.style.display='block';

  // Title = Name (#no)
  const rec = Object.values(window.__rawData||{}).find(x => canonKey(norm(x?.Name))===key);
  const displayName = rec?.Name || key;
  const num = constNameToNo[key] || '';
  document.getElementById('previewTitle').textContent = displayName + (num ? ` (#${num})` : '');

  // Hint aria-live
  let hint = 'Review the area below · Use the button to open the Interactive Map';
  try{
    const block = document.querySelector(`.const[data-key="${key}"]`);
    const rows  = JSON.parse(block?.dataset?.candidates || '[]');
    const lead  = rows[0];
    const boxes = block?.dataset?.boxes || '';
    if (lead){
      const P = partyKey(lead.party);
      hint = `${lead.name} (${P}) leading • ${Number(lead.votes||0).toLocaleString()} votes${boxes ? ` • Boxes: ${boxes}` : ''}`;
    } else if (boxes) { hint = `Boxes: ${boxes}`; }
  }catch(_){}
  document.querySelector('.modal-hint').textContent = hint;

  // Details table + boxes
  populatePreviewDetails(key);

  // Build a fresh layer with pulsing on target, others muted
  if (previewLayer){ previewLayer.remove(); previewLayer=null; }
  previewLayer = L.geoJSON({type:'FeatureCollection', features: arcFeatures}, {
    style:(feat)=>{
      const nm = feat?.properties?.CONST_NAME || '';
      const k  = norm(nm);
      const isTarget = (k===key);
      const fill = isTarget ? (leaderColors[key] || '#60a5fa') : '#cbd5e1';
      return { color: isTarget ? '#111827' : '#94a3b8', weight: isTarget ? 3 : 1, fillColor: fill, fillOpacity: isTarget ? 0.8 : 0.5 };
    }
  }).addTo(previewMap);

  // Fit to parish bounds, then extra zoom
  let target=null, parish=null;
  previewLayer.eachLayer(l=>{
    const nm = l.feature?.properties?.CONST_NAME || '';
    if (norm(nm)===key){ target=l; parish=l.feature?.properties?.PARISH_NAM; }
  });
  if (target){
    const grp=[]; previewLayer.eachLayer(l=>{ if (l.feature?.properties?.PARISH_NAM===parish) grp.push(l); });
    const bounds = (grp.length ? L.featureGroup(grp) : target).getBounds();
    try{
      previewMap.fitBounds(bounds, {padding:[24,24]});
      setTimeout(()=> previewMap.zoomIn(1), 120);
    }catch(_){}
    startPulse(target);
  }
  setTimeout(()=> {
    previewMap.invalidateSize();
    if (shim) shim.style.display='none';
  }, 120);

  // Map click = go interactive
  previewMap.off('click');
  previewMap.on('click', ()=> {
    const k = previewKey; closePreview(); if (k) gotoInteractiveKey(k);
  });

  // Focus mgmt
  const goBtn = document.getElementById('btnPreviewGo');
  if (goBtn) goBtn.focus();

  // Deep link hash by number
  if (num) location.hash = '#'+num;
}

/* Modal buttons + keyboard */
document.getElementById('btnPreviewClose').addEventListener('click', closePreview);
document.getElementById('btnPreviewCancel').addEventListener('click', closePreview);
document.getElementById('btnPreviewGo').addEventListener('click', ()=>{ const k=previewKey; closePreview(); if (k) gotoInteractiveKey(k); });
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') closePreview();
  if (e.key === 'Enter' && document.getElementById('previewModal').classList.contains('show')){
    const k = previewKey; closePreview(); if (k) gotoInteractiveKey(k);
  }
});
document.getElementById('previewModal').addEventListener('click', (e)=>{
  if (e.target.id === 'previewModal') closePreview();
});

/* ===== Auto ===== */
function setupAutoRefresh(){
  if (refreshTimer) clearInterval(refreshTimer);
  const ms = Number(localStorage.getItem('refreshIntervalMs')||sel.value||AUTO_DEFAULT);
  refreshTimer = setInterval(loadECJAndData, ms);
}

/* ===== Sort re-render (then re-cache) ===== */
function applySortRebuild(){
  const data = window.__rawData || {};
  const detailsByConst={};
  Object.values(data).forEach(c=>{
    const cname=c?.Name||''; const cData=Array.isArray(c?.Data)? c.Data[0] : c?.Data;
    const cand = Array.isArray(cData?.Candidates)? cData.Candidates : [];
    if(!cname || !cand.length) return;
    let key = canonKey(norm(cname));
    const safePct  = (x)=> Number(x)||0;
    const safeVote = (x)=> Number(x)||0;
    const winner = cand.reduce((m,x)=> safeVote(x.Votes)>safeVote(m.Votes)? x : m, cand[0]);
    const sorted = cand.slice().sort((a,b)=> safePct(b.Percentage)-safePct(a.Percentage)).map(k=>({
      name:`${(k["First Name"]||'').trim()} ${(k["Last Name"]||'').trim()}`.trim(),
      party:partyKey(k.Party),
      votes:safeVote(k.Votes),
      pct:safePct(k.Percentage)
    }));
    detailsByConst[key] = { party:partyKey(winner?.Party), all: sorted };
  });
  renderParishBlocks(detailsByConst, data);
  cacheConstNodes();           // important: refresh cache
  applyFacetFilters();         // keep current filters active
}

/* ===== Start ===== */
(async function start(){
  initTheme();
  initDensity();           // ← add this line
  updateStickyOffsets();
  ...
})();
 /* ===== Density toggle (Comfortable / Compact) ===== */
function applyDensity(mode){
  const m = (mode === 'compact') ? 'compact' : 'comfortable';
  document.documentElement.setAttribute('data-density', m);
  const btn = document.getElementById('densityBtn');
  if (btn) btn.textContent = '↔ Density: ' + (m === 'compact' ? 'Compact' : 'Comfortable');
  localStorage.setItem('density', m);
}

function initDensity(){
  const saved = localStorage.getItem('density') || 'comfortable';
  applyDensity(saved);
  const btn = document.getElementById('densityBtn');
  if (btn){
    btn.addEventListener('click', ()=>{
      const curr = document.documentElement.getAttribute('data-density') || 'comfortable';
      applyDensity(curr === 'compact' ? 'comfortable' : 'compact');
    });
  }
}
  updateStickyOffsets();
  try{ await loadECJBoundaries(); }catch(_){}
  initNationalMap(); initInteractiveMap();
  buildLegendInto('mapLegend'); buildLegendInto('imapLegend');
  await loadECJAndData();
  setupAutoRefresh();

  // Update the single pill to show local state
  const pill = document.getElementById('pillMain');
  if (pill){ pill.title = 'Using local 2025-data.json'; document.getElementById('mainLag').textContent = 'Local file'; }

  // Wire up filters & sort
  document.getElementById('parishFilter').addEventListener('change', applyFacetFilters);
  document.getElementById('partyFilter').addEventListener('change', applyFacetFilters);
  document.getElementById('cnoFilter').addEventListener('input', debounce(applyFacetFilters, 150));
  document.getElementById('sortField').addEventListener('change', applySortRebuild);
  document.getElementById('sortDir').addEventListener('change', applySortRebuild);
})();
