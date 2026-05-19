import { describe, expect, it } from 'vitest';

import { isPathExcluded } from '../exclusion';

describe('isPathExcluded', () => {
	it('returns false for null notePath', () => {
		expect(isPathExcluded(null, ['Foo'])).toBe(false);
	});

	it('returns false when exclusion list is empty', () => {
		expect(isPathExcluded('Foo/bar.md', [])).toBe(false);
	});

	it('matches a direct folder prefix', () => {
		expect(isPathExcluded('Outputs/The Tao of Rob/note.md', ['Outputs/The Tao of Rob'])).toBe(
			true,
		);
	});

	it('matches with a trailing slash on the configured folder', () => {
		expect(
			isPathExcluded('Outputs/Rob\'s Hammer/idea.md', ['Outputs/Rob\'s Hammer/']),
		).toBe(true);
	});

	it('matches an exact folder-equals-path (single-file folder edge case)', () => {
		expect(isPathExcluded('Foo', ['Foo'])).toBe(true);
	});

	it('does not partial-match on shared prefix that is not a folder boundary', () => {
		expect(isPathExcluded('Outputs/Taoism/note.md', ['Outputs/Tao'])).toBe(false);
	});

	it('returns false for a note outside every configured folder', () => {
		expect(
			isPathExcluded('Brain Soup/idea.md', [
				'Outputs/The Tao of Rob',
				'Outputs/Rob\'s Hammer',
				'Outputs/The Diuniverse',
			]),
		).toBe(false);
	});

	it('skips empty entries in the exclusion list', () => {
		expect(isPathExcluded('Foo/bar.md', ['', 'Bar'])).toBe(false);
	});
});
