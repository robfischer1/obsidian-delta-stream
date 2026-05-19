/**
 * Writing-session boundary tracker.
 *
 * A session is the span between the first edit after an idle gap and the
 * editor going idle / blurring / closing. Idle threshold is configured via
 * settings.idleSessionGapMs (Phase 0 Q12 default 5 min).
 *
 * The tracker is pure timer logic — it does not know about Obsidian, files,
 * or events. The dispatcher subscribes to onIdle and emits the actual
 * `session-end` event with the closed id.
 */

export interface TimerHandle {
	cancel(): void;
}

export type TimerScheduler = (cb: () => void, ms: number) => TimerHandle;

export const defaultScheduler: TimerScheduler = (cb, ms) => {
	const id = setTimeout(cb, ms);
	return {
		cancel: () => clearTimeout(id),
	};
};

export class SessionTracker {
	private current: string | null = null;
	private timer: TimerHandle | null = null;

	constructor(
		private readonly idleGapMs: number,
		private readonly onIdle: (closedId: string) => void,
		private readonly scheduler: TimerScheduler = defaultScheduler,
		private readonly idFactory: (ts: number) => string = defaultSessionId,
	) {}

	/** Record activity. Starts a new session if none, resets the idle timer either way. */
	touch(ts: number): { sessionId: string; started: boolean } {
		let started = false;
		if (this.current === null) {
			this.current = this.idFactory(ts);
			started = true;
		}
		this.resetTimer();
		return { sessionId: this.current, started };
	}

	/** End the current session immediately. Returns the closed id or null if none was active. */
	close(): string | null {
		const id = this.current;
		this.current = null;
		if (this.timer !== null) {
			this.timer.cancel();
			this.timer = null;
		}
		return id;
	}

	currentId(): string | null {
		return this.current;
	}

	private resetTimer(): void {
		if (this.timer !== null) this.timer.cancel();
		this.timer = this.scheduler(() => {
			this.timer = null;
			const id = this.current;
			this.current = null;
			if (id !== null) this.onIdle(id);
		}, this.idleGapMs);
	}
}

function defaultSessionId(ts: number): string {
	const rand = Math.floor(Math.random() * 0xff_ffff)
		.toString(16)
		.padStart(6, '0');
	return `s_${ts.toString(36)}_${rand}`;
}
