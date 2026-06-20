import type { ISODate, ISODateTime } from '../types';

/** Local calendar date as YYYY-MM-DD. */
export function todayISODate(d: Date = new Date()): ISODate {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Local datetime as YYYY-MM-DDTHH:MM:SS (no timezone, no millis). */
export function nowISODateTime(d: Date = new Date()): ISODateTime {
	const date = todayISODate(d);
	const hh = String(d.getHours()).padStart(2, '0');
	const mm = String(d.getMinutes()).padStart(2, '0');
	const ss = String(d.getSeconds()).padStart(2, '0');
	return `${date}T${hh}:${mm}:${ss}`;
}

/** Milliseconds for an ISO datetime string, or null if unparseable. */
export function parseISODateTime(value: ISODateTime | null): number | null {
	if (!value) return null;
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : ms;
}

/** Extract just the HH:MM:SS portion from an ISO datetime, for table display. */
export function timeOfDay(value: ISODateTime | null): string {
	if (!value) return '';
	const t = value.indexOf('T');
	return t >= 0 ? value.slice(t + 1) : value;
}

/** Format a duration in seconds as M:SS (or H:MM:SS past an hour). */
export function formatStopwatch(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	const seconds = s % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
