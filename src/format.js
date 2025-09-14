export function fmtNumber(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function fmtPercent(p, digits = 1) {
  if (isNaN(p)) return '—';
  return p.toFixed(digits) + '%';
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
