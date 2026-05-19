import path from 'node:path';

import type { RingBuffer } from '../capture/buffer';
import type { DeltaEvent } from '../capture/events';
import { ndjsonFilenameForDate, resolveStorageDirectory } from './paths';
import { NdjsonWriter } from './writer';

export interface PersisterOptions {
	storageDirectory: string;
	/** For tests — substitute a fake writer. */
	writer?: NdjsonWriter;
	onError?: (err: Error) => void;
}

/**
 * Subscribes to a RingBuffer, batches events into a `pending` queue, and
 * flushes the queue to day-partitioned NDJSON files. Flush triggers:
 *
 *   - the configured interval (`start(intervalMs)`),
 *   - any `session-end` event (immediate — crash-safety boundary),
 *   - `stop()` (called from `Plugin.onunload`).
 */
export class Persister {
	private readonly writer: NdjsonWriter;
	private readonly resolvedDir: string;
	private pending: DeltaEvent[] = [];
	private timer: ReturnType<typeof setInterval> | null = null;
	private dirEnsured = false;
	private unsubscribe: (() => void) | null = null;

	constructor(
		private readonly buffer: RingBuffer,
		opts: PersisterOptions,
	) {
		this.writer = opts.writer ?? new NdjsonWriter({ onError: opts.onError });
		this.resolvedDir = resolveStorageDirectory(opts.storageDirectory);
	}

	/** Begin subscribing + (optionally) interval-flushing. */
	start(intervalMs: number): void {
		this.unsubscribe?.();
		this.unsubscribe = this.buffer.subscribe((event) => {
			this.pending.push(event);
			if (event.type === 'session-end') {
				// Immediate flush — crash-safety boundary.
				void this.flush();
			}
		});
		if (intervalMs > 0) {
			this.timer = setInterval(() => {
				void this.flush();
			}, intervalMs);
		}
	}

	/** Stop subscribing + interval, then flush any pending events. */
	async stop(): Promise<void> {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.unsubscribe?.();
		this.unsubscribe = null;
		await this.flush();
		await this.writer.drain();
	}

	/** Drain `pending` to disk, bucketed by local-time day. */
	async flush(): Promise<void> {
		if (this.pending.length === 0) return;
		const events = this.pending;
		this.pending = [];

		if (!this.dirEnsured) {
			await this.writer.ensureDir(this.resolvedDir);
			this.dirEnsured = true;
		}

		const buckets = new Map<string, string[]>();
		for (const e of events) {
			const filename = ndjsonFilenameForDate(new Date(e.ts));
			const line = JSON.stringify(e);
			const list = buckets.get(filename);
			if (list === undefined) buckets.set(filename, [line]);
			else list.push(line);
		}

		for (const [filename, lines] of buckets) {
			const fp = path.join(this.resolvedDir, filename);
			await this.writer.append(fp, lines);
		}
	}

	/** Reference to the resolved storage directory — useful in the settings tab + tests. */
	get storageDirectory(): string {
		return this.resolvedDir;
	}

	/** Pending-event count — useful in tests + future status-bar display. */
	get pendingCount(): number {
		return this.pending.length;
	}
}
