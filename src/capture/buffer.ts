import type { DeltaEvent } from './events';

export type EventListener = (event: DeltaEvent) => void;

/**
 * Fixed-capacity ring buffer with subscriber callbacks.
 * - Push is O(1). Listener errors are swallowed so a misbehaving consumer
 *   never blocks capture (Phase 2 non-goal: back-pressure that stalls the editor).
 * - When full, the oldest event is overwritten — by design. Phase 3 sizes the
 *   buffer so this only happens under pathological burst with no flushes.
 */
export class RingBuffer {
	private readonly events: Array<DeltaEvent | undefined>;
	private head = 0;
	private count = 0;
	private readonly listeners = new Set<EventListener>();

	constructor(public readonly capacity: number) {
		if (capacity <= 0) throw new Error('RingBuffer capacity must be > 0');
		this.events = new Array<DeltaEvent | undefined>(capacity);
	}

	push(event: DeltaEvent): void {
		const index = (this.head + this.count) % this.capacity;
		this.events[index] = event;
		if (this.count < this.capacity) {
			this.count++;
		} else {
			this.head = (this.head + 1) % this.capacity;
		}
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch {
				// Listener errors must not propagate into the editor's hot path.
			}
		}
	}

	snapshot(): DeltaEvent[] {
		const out: DeltaEvent[] = [];
		for (let i = 0; i < this.count; i++) {
			const evt = this.events[(this.head + i) % this.capacity];
			if (evt !== undefined) out.push(evt);
		}
		return out;
	}

	drain(): DeltaEvent[] {
		const snap = this.snapshot();
		this.head = 0;
		this.count = 0;
		this.events.fill(undefined);
		return snap;
	}

	get length(): number {
		return this.count;
	}

	subscribe(listener: EventListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}
