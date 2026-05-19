import { describe, expect, it, vi } from 'vitest';

import { SessionTracker, type TimerHandle, type TimerScheduler } from '../session';

interface FakeClock {
	scheduler: TimerScheduler;
	advance(ms: number): void;
}

function makeFakeClock(): FakeClock {
	let pending: { cb: () => void; fireAt: number } | null = null;
	let now = 0;
	const scheduler: TimerScheduler = (cb, ms) => {
		pending = { cb, fireAt: now + ms };
		const handle: TimerHandle = {
			cancel: () => {
				if (pending !== null && pending.cb === cb) pending = null;
			},
		};
		return handle;
	};
	return {
		scheduler,
		advance(ms: number) {
			now += ms;
			while (pending !== null && pending.fireAt <= now) {
				const { cb } = pending;
				pending = null;
				cb();
			}
		},
	};
}

const fixedId = (ts: number): string => `s_${ts}`;

describe('SessionTracker', () => {
	it('starts a session on first touch and reuses it on subsequent touches', () => {
		const clock = makeFakeClock();
		const onIdle = vi.fn();
		const tracker = new SessionTracker(1_000, onIdle, clock.scheduler, fixedId);

		const a = tracker.touch(100);
		expect(a.started).toBe(true);
		expect(a.sessionId).toBe('s_100');

		const b = tracker.touch(200);
		expect(b.started).toBe(false);
		expect(b.sessionId).toBe('s_100');
	});

	it('fires onIdle with the closed id after the configured gap', () => {
		const clock = makeFakeClock();
		const onIdle = vi.fn();
		const tracker = new SessionTracker(1_000, onIdle, clock.scheduler, fixedId);

		tracker.touch(0);
		clock.advance(999);
		expect(onIdle).not.toHaveBeenCalled();
		clock.advance(1);
		expect(onIdle).toHaveBeenCalledTimes(1);
		expect(onIdle).toHaveBeenCalledWith('s_0');
		expect(tracker.currentId()).toBeNull();
	});

	it('resets the idle timer on each touch', () => {
		const clock = makeFakeClock();
		const onIdle = vi.fn();
		const tracker = new SessionTracker(1_000, onIdle, clock.scheduler, fixedId);

		tracker.touch(0);
		clock.advance(900);
		tracker.touch(900);
		clock.advance(900);
		expect(onIdle).not.toHaveBeenCalled();
		clock.advance(200);
		expect(onIdle).toHaveBeenCalledTimes(1);
	});

	it('close returns the active id and silences the timer', () => {
		const clock = makeFakeClock();
		const onIdle = vi.fn();
		const tracker = new SessionTracker(1_000, onIdle, clock.scheduler, fixedId);

		tracker.touch(0);
		const closed = tracker.close();
		expect(closed).toBe('s_0');
		clock.advance(2_000);
		expect(onIdle).not.toHaveBeenCalled();
		expect(tracker.currentId()).toBeNull();
	});

	it('close returns null when no session is active', () => {
		const tracker = new SessionTracker(1_000, vi.fn(), makeFakeClock().scheduler, fixedId);
		expect(tracker.close()).toBeNull();
	});

	it('touch after close starts a fresh session', () => {
		const clock = makeFakeClock();
		const tracker = new SessionTracker(1_000, vi.fn(), clock.scheduler, fixedId);

		tracker.touch(0);
		tracker.close();
		const next = tracker.touch(500);
		expect(next.started).toBe(true);
		expect(next.sessionId).toBe('s_500');
	});
});
