import { Notice } from 'obsidian';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import type { ISODate, JournalAnswer, JournalDay, JournalItem } from '../../types';
import { AUTOSAVE_DEBOUNCE_MS, TYPE_JOURNAL } from '../../utils/constants';
import { addDays, nowISODateTime, todayISODate } from '../../utils/date';
import {
	copyAnswer,
	countLabel,
	describeAnswer,
	DOSAGE_UNITS,
	emptyAnswer,
	FIELD_LABELS,
	fromTimeInput,
	INTENSITY_MAX,
	minutesBetween,
	resolveEnd,
	toTimeInput,
} from '../../services/journal';
import { usePlugin } from '../context';
import { useNav } from '../navigation';
import { NumberField } from '../components/number-field';
import { confirm } from '../modals/prompts';

function emptyDay(date: ISODate): JournalDay {
	return { type: TYPE_JOURNAL, date, updated: null, entries: [] };
}

/** "2026-10-23" -> "Fri, Oct 23" (local). */
function formatDate(date: ISODate): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	});
}

function TimeInput({
	value,
	onChange,
	showNow,
}: {
	value: string;
	onChange: (hhmm: string) => void;
	showNow: boolean;
}): ReactElement {
	return (
		<span className="gymmd-journal-time">
			<input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
			{showNow && <button onClick={() => onChange(nowISODateTime().slice(11, 16))}>Now</button>}
		</span>
	);
}

/** The detail inputs for one answer (one occurrence of an item). */
function AnswerFields({
	item,
	answer,
	date,
	onChange,
}: {
	item: JournalItem;
	answer: JournalAnswer;
	date: ISODate;
	onChange: (answer: JournalAnswer) => void;
}): ReactElement {
	const isToday = date === todayISODate();
	const has = (f: JournalItem['fields'][number]) => item.fields.includes(f);

	const set = (patch: Partial<JournalAnswer>) => {
		const next = { ...answer, ...patch };
		// With both ends of a span known, the duration follows from them.
		if (has('start') && has('end') && has('duration') && ('start' in patch || 'end' in patch)) {
			const mins = minutesBetween(next.start, next.end);
			if (mins !== null) next.duration_min = mins;
		}
		onChange(next);
	};

	const onStart = (hhmm: string) => {
		const start = fromTimeInput(date, hhmm);
		// Re-anchor the end so "22:00 → 03:00" stays an overnight span.
		const end = answer.end ? resolveEnd(date, toTimeInput(answer.end), start) : null;
		set({ start, end });
	};

	const dosageUnit = answer.dosage_unit ?? item.dosage_unit;
	const unitOptions = DOSAGE_UNITS.includes(dosageUnit) || !dosageUnit ? DOSAGE_UNITS : [dosageUnit, ...DOSAGE_UNITS];

	return (
		<div className="gymmd-journal-fields">
			{has('time') && (
				<label>
					<span>{FIELD_LABELS.time}</span>
					<TimeInput
						value={toTimeInput(answer.time)}
						showNow={isToday}
						onChange={(v) => set({ time: fromTimeInput(date, v) })}
					/>
				</label>
			)}
			{has('start') && (
				<label>
					<span>{FIELD_LABELS.start}</span>
					<TimeInput value={toTimeInput(answer.start)} showNow={isToday} onChange={onStart} />
				</label>
			)}
			{has('end') && (
				<label>
					<span>
						{FIELD_LABELS.end}
						{answer.end && answer.end.slice(0, 10) > date ? ' (next day)' : ''}
					</span>
					<TimeInput
						value={toTimeInput(answer.end)}
						showNow={isToday}
						onChange={(v) => set({ end: resolveEnd(date, v, answer.start) })}
					/>
				</label>
			)}
			{has('duration') && (
				<label>
					<span>{FIELD_LABELS.duration}</span>
					<NumberField
						kind="amount"
						value={answer.duration_min}
						onChange={(v) => set({ duration_min: v })}
					/>
				</label>
			)}
			{has('count') && (
				<label>
					<span>{countLabel(answer.count_unit ?? item.count_unit)}</span>
					<NumberField
						kind="amount"
						value={answer.count}
						onChange={(v) =>
							set({ count: v, count_unit: answer.count_unit ?? (item.count_unit || null) })
						}
					/>
				</label>
			)}
			{has('dosage') && (
				<label>
					<span>{FIELD_LABELS.dosage}</span>
					<span className="gymmd-journal-dosage">
						<NumberField
							kind="amount"
							value={answer.dosage}
							onChange={(v) => set({ dosage: v, dosage_unit: dosageUnit || null })}
						/>
						<select
							className="dropdown"
							value={dosageUnit}
							onChange={(e) => set({ dosage_unit: e.target.value })}
						>
							{unitOptions.map((u) => (
								<option key={u} value={u}>
									{u}
								</option>
							))}
						</select>
					</span>
				</label>
			)}
			{has('intensity') && (
				<div className="gymmd-journal-intensity-field">
					<span>{FIELD_LABELS.intensity}</span>
					<div className="gymmd-journal-intensity">
						{Array.from({ length: INTENSITY_MAX }, (_, i) => i + 1).map((n) => (
							<button
								key={n}
								className={answer.intensity === n ? 'gymmd-tab-active' : ''}
								onClick={() => set({ intensity: answer.intensity === n ? null : n })}
							>
								{n}
							</button>
						))}
					</div>
				</div>
			)}
			{has('note') && (
				<label className="gymmd-journal-note">
					<span>{FIELD_LABELS.note}</span>
					<textarea
						rows={2}
						value={answer.note}
						onChange={(e) => set({ note: e.target.value })}
					/>
				</label>
			)}
		</div>
	);
}

interface CardProps {
	item: JournalItem;
	/** This day's answers for the item — several for a repeatable item. */
	answers: JournalAnswer[];
	date: ISODate;
	prev: { answers: JournalAnswer[]; date: ISODate } | null;
	onChange: (answers: JournalAnswer[]) => void;
}

function JournalCard({ item, answers, date, prev, onChange }: CardProps): ReactElement {
	const plugin = usePlugin();
	const status = answers.length ? answers[0].answer : null;

	/** Confirm before an action that would drop several logged occurrences. */
	const discardOk = (cta: string, message: string) =>
		answers.length < 2 || confirm(plugin.app, { title: item.name, message, cta, danger: true });

	const choose = async (yes: boolean) => {
		if (status === yes) {
			// Tap again to clear.
			if (await discardOk('Clear', `Remove all ${answers.length} entries logged for this day?`)) onChange([]);
		} else if (!answers.length) {
			onChange([emptyAnswer(item, yes)]);
		} else if (yes) {
			onChange(answers.map((a) => ({ ...a, answer: true })));
		} else if (
			await discardOk('Answer no', `Answering no keeps one entry and removes the other ${answers.length - 1}.`)
		) {
			// "No" is a single answer; keep the first entry's details in case of a mis-tap.
			onChange([{ ...answers[0], answer: false }]);
		}
	};

	const updateAt = (i: number, a: JournalAnswer) => onChange(answers.map((x, j) => (j === i ? a : x)));
	const removeAt = (i: number) => onChange(answers.filter((_, j) => j !== i));

	const prevSummary = prev
		? prev.answers
				.map((a) => describeAnswer(a, prev.date))
				.filter(Boolean)
				.join(' | ')
		: '';
	const prevLabel = !prev
		? ''
		: !prev.answers[0].answer
			? 'No'
			: prev.answers.length > 1
				? `Yes ×${prev.answers.length}`
				: 'Yes';

	return (
		<div className={`gymmd-journal-card${answers.length ? ' gymmd-journal-answered' : ''}`}>
			<div className="gymmd-journal-card-head">
				<div>
					<div className="gymmd-journal-name">{item.name}</div>
					{item.hint && <div className="gymmd-muted">{item.hint}</div>}
				</div>
				<div className="gymmd-journal-yesno">
					<button className={status === true ? 'gymmd-tab-active' : ''} onClick={() => void choose(true)}>
						Yes{status === true && answers.length > 1 ? ` ×${answers.length}` : ''}
					</button>
					<button className={status === false ? 'gymmd-tab-active' : ''} onClick={() => void choose(false)}>
						No
					</button>
				</div>
			</div>

			{prev && (
				<button
					className="gymmd-journal-copy gymmd-link"
					onClick={() => onChange(prev.answers.map((a) => copyAnswer(a, prev.date, date, item)))}
				>
					↺ Same as {formatDate(prev.date)}: {prevLabel}
					{prevSummary ? ` · ${prevSummary}` : ''}
				</button>
			)}

			{status === true &&
				answers.map((a, i) => (
					// Index keys are fine: occurrences have no identity beyond their position.
					<div key={i} className={answers.length > 1 ? 'gymmd-journal-occurrence' : ''}>
						{answers.length > 1 && (
							<div className="gymmd-journal-occurrence-head">
								<span className="gymmd-muted">#{i + 1}</span>
								<button className="gymmd-link gymmd-journal-copy" onClick={() => removeAt(i)}>
									Remove
								</button>
							</div>
						)}
						{item.fields.length > 0 && (
							<AnswerFields item={item} answer={a} date={date} onChange={(next) => updateAt(i, next)} />
						)}
					</div>
				))}

			{status === true && item.repeatable && (
				<button className="gymmd-journal-add" onClick={() => onChange([...answers, emptyAnswer(item, true)])}>
					+ Add another
				</button>
			)}
		</div>
	);
}

export function Journal(): ReactElement {
	const plugin = usePlugin();
	const nav = useNav();
	const today = todayISODate();
	const [date, setDate] = useState<ISODate>(today);
	const [items, setItems] = useState<JournalItem[] | null>(null);
	const [day, setDay] = useState<JournalDay | null>(null);
	const [prev, setPrev] = useState<JournalDay | null>(null);

	// Autosave state lives in refs: the on-disk baseline for conflict checks,
	// the latest unsaved day, and a promise chain so writes never overlap.
	const baseline = useRef<string | null>(null);
	const pending = useRef<JournalDay | null>(null);
	const timer = useRef<number | null>(null);
	const chain = useRef<Promise<void>>(Promise.resolve());

	const flush = useCallback((): Promise<void> => {
		if (timer.current) {
			window.clearTimeout(timer.current);
			timer.current = null;
		}
		chain.current = chain.current.then(async () => {
			const d = pending.current;
			pending.current = null;
			if (!d) return;
			// Don't create a file for a day that was never actually answered.
			if (baseline.current === null && d.entries.length === 0) return;
			const res = await plugin.journal.saveDay({ ...d, updated: nowISODateTime() }, baseline.current);
			if (res.ok) {
				baseline.current = res.content;
			} else {
				new Notice('Journal file changed on disk — reloaded. Please redo your last change.');
				baseline.current = res.reloaded.content;
				setDay(res.reloaded.day ?? emptyDay(d.date));
			}
		});
		return chain.current;
	}, [plugin]);

	useEffect(() => {
		void plugin.journal.loadItems().then((data) => setItems(data.items));
	}, [plugin]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await flush(); // finish writing the previous date first
			const [loaded, previous] = await Promise.all([
				plugin.journal.loadDay(date),
				plugin.journal.findPrevious(date),
			]);
			if (cancelled) return;
			baseline.current = loaded.content;
			setDay(loaded.day ?? emptyDay(date));
			setPrev(previous);
		})();
		return () => {
			cancelled = true;
		};
	}, [plugin, date, flush]);

	// Save anything still pending when leaving the screen.
	useEffect(() => () => void flush(), [flush]);

	const mutate = (fn: (d: JournalDay) => void) => {
		if (!day || day.date !== date) return; // the new date is still loading
		const next = structuredClone(day);
		fn(next);
		// Keep entries in item order (stable, so repeat occurrences keep theirs);
		// answers for unknown/deleted items go last.
		const rank = new Map(items?.map((it, i) => [it.item_id, i]) ?? []);
		next.entries.sort(
			(a, b) => (rank.get(a.item_id) ?? Infinity) - (rank.get(b.item_id) ?? Infinity),
		);
		setDay(next);
		pending.current = next;
		if (timer.current) window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DEBOUNCE_MS);
	};

	const setAnswers = (itemId: string, answers: JournalAnswer[]) =>
		mutate((d) => {
			// Answers for disabled items aren't shown but are kept untouched.
			d.entries = d.entries.filter((e) => e.item_id !== itemId);
			d.entries.push(...answers);
		});

	const enabled = items?.filter((it) => it.enabled) ?? [];
	const answersFor = (id: string) => day?.entries.filter((e) => e.item_id === id) ?? [];
	const prevFor = (id: string) => {
		const answers = prev?.entries.filter((e) => e.item_id === id) ?? [];
		return answers.length && prev ? { answers, date: prev.date } : null;
	};
	const fillable = enabled.filter((it) => !answersFor(it.item_id).length && prevFor(it.item_id));
	const answeredCount = enabled.filter((it) => answersFor(it.item_id).length).length;

	const fillFromPrevious = () => {
		if (!prev) return;
		mutate((d) => {
			for (const it of fillable) {
				for (const p of prev.entries.filter((e) => e.item_id === it.item_id)) {
					d.entries.push(copyAnswer(p, prev.date, d.date, it));
				}
			}
		});
	};

	return (
		<div className="gymmd-view gymmd-journal">
			<div className="gymmd-header">
				<h2>Journal</h2>
				<button onClick={() => nav.navigate('journal-items')}>Manage items</button>
			</div>

			<div className="gymmd-journal-datebar">
				<button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
					‹
				</button>
				<input
					type="date"
					value={date}
					max={today}
					onChange={(e) => e.target.value && setDate(e.target.value)}
				/>
				<button
					aria-label="Next day"
					disabled={date >= today}
					onClick={() => setDate(addDays(date, 1))}
				>
					›
				</button>
				{date !== today && <button onClick={() => setDate(today)}>Today</button>}
			</div>

			{!items || !day ? (
				<p>Loading…</p>
			) : enabled.length === 0 ? (
				<p className="gymmd-empty">No journal items enabled — tap Manage items to add or enable some.</p>
			) : (
				<>
					<div className="gymmd-journal-summary">
						<span className="gymmd-muted">
							{formatDate(date)} · {answeredCount} of {enabled.length} answered
						</span>
						{prev && fillable.length > 0 && (
							<button onClick={fillFromPrevious}>
								Fill {fillable.length} from {formatDate(prev.date)}
							</button>
						)}
					</div>
					{enabled.map((it) => (
						<JournalCard
							key={it.item_id}
							item={it}
							date={date}
							answers={answersFor(it.item_id)}
							prev={prevFor(it.item_id)}
							onChange={(a) => setAnswers(it.item_id, a)}
						/>
					))}
				</>
			)}
		</div>
	);
}
