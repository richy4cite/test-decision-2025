<<<<<<< Updated upstream
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
=======
// Formatting helpers
export function fmtNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function fmtPercent(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const { digits = 1 } = opts;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }) + '%';
}

// timeAgo: produce human-friendly relative time; fallback to ISO
export function timeAgo(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return diffSec + 's ago';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin + 'm ago';
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + 'h ago';
  const diffDay = Math.floor(diffHr / 24);
  return diffDay + 'd ago';
}
>>>>>>> Stashed changes
