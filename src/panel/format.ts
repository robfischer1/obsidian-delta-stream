/** Display formatters for the panel. Pure functions, no Obsidian deps. */

export function formatRelativeTime(ts: number, now: number = Date.now()): string {
	const diff = now - ts;
	if (diff < 0) return 'in the future';
	const s = Math.floor(diff / 1000);
	if (s < 60) return 'just now';
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d}d ago`;
	const w = Math.floor(d / 7);
	if (w < 5) return `${w}w ago`;
	const date = new Date(ts);
	return date.toLocaleDateString();
}

export function formatDuration(ms: number | null): string {
	if (ms === null) return 'ongoing';
	if (ms < 1000) return `${ms}ms`;
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const remainderS = s % 60;
	if (m < 60) return `${m}m ${remainderS}s`;
	const h = Math.floor(m / 60);
	const remainderM = m % 60;
	return `${h}h ${remainderM}m`;
}

export function formatRewriteRatio(ratio: number): string {
	if (ratio === 0) return '0';
	if (ratio < 1) return ratio.toFixed(2);
	return ratio.toFixed(2);
}

/** Truncate a string with an ellipsis if longer than `max`. */
export function ellipsize(s: string, max: number): string {
	if (s.length <= max) return s;
	return s.slice(0, max - 1) + '…';
}
