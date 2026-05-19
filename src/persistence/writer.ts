import { promises as fs } from 'node:fs';

export interface NdjsonWriterOptions {
	onError?: (err: Error) => void;
}

/**
 * Append-only NDJSON writer. All writes pass through a single promise queue
 * so concurrent callers can never interleave bytes within a line. Failures
 * are surfaced via `onError` rather than thrown — the editor must keep going
 * even if disk is full or the directory was deleted out from under us.
 */
export class NdjsonWriter {
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(private readonly opts: NdjsonWriterOptions = {}) {}

	async ensureDir(dir: string): Promise<void> {
		try {
			await fs.mkdir(dir, { recursive: true });
		} catch (err) {
			this.report(err);
		}
	}

	/** Append `lines` (no trailing newlines) to `filepath` as NDJSON. */
	append(filepath: string, lines: readonly string[]): Promise<void> {
		if (lines.length === 0) return this.writeQueue;
		const payload = lines.join('\n') + '\n';
		this.writeQueue = this.writeQueue.then(async () => {
			try {
				await fs.appendFile(filepath, payload, 'utf8');
			} catch (err) {
				this.report(err);
			}
		});
		return this.writeQueue;
	}

	/** Resolves after every previously-queued write has settled. */
	drain(): Promise<void> {
		return this.writeQueue;
	}

	private report(err: unknown): void {
		const e = err instanceof Error ? err : new Error(String(err));
		this.opts.onError?.(e);
	}
}
