import { describe, expect, it } from 'vitest';

import {
	NEVER_DRAFT_FOLDERS,
	parseExcludedFolders,
	withNeverDraftFolders,
} from '../settings-types';

describe('parseExcludedFolders', () => {
	it('splits on newlines and trims', () => {
		expect(parseExcludedFolders('Foo\nBar/Baz\n  Qux  ')).toEqual([
			'Foo',
			'Bar/Baz',
			'Qux',
		]);
	});

	it('drops empty and whitespace-only lines', () => {
		expect(parseExcludedFolders('\n\nFoo\n   \nBar\n')).toEqual(['Foo', 'Bar']);
	});

	it('returns an empty list for empty input', () => {
		expect(parseExcludedFolders('')).toEqual([]);
		expect(parseExcludedFolders('   \n  \n')).toEqual([]);
	});
});

describe('withNeverDraftFolders', () => {
	it('appends all three never-draft folders to an empty list', () => {
		expect(withNeverDraftFolders([])).toEqual([...NEVER_DRAFT_FOLDERS]);
	});

	it('preserves existing entries and order', () => {
		expect(withNeverDraftFolders(['Brain Soup', 'Atlas'])).toEqual([
			'Brain Soup',
			'Atlas',
			...NEVER_DRAFT_FOLDERS,
		]);
	});

	it('does not duplicate a never-draft folder that is already present', () => {
		expect(withNeverDraftFolders(['Outputs/The Tao of Rob'])).toEqual([
			'Outputs/The Tao of Rob',
			"Outputs/Rob's Hammer",
			'Outputs/The Diuniverse',
		]);
	});

	it('dedupes already-duplicated existing entries', () => {
		expect(withNeverDraftFolders(['Foo', 'Foo', 'Bar'])).toEqual([
			'Foo',
			'Bar',
			...NEVER_DRAFT_FOLDERS,
		]);
	});
});

describe('NEVER_DRAFT_FOLDERS', () => {
	it('contains exactly the three governance-named folders', () => {
		expect([...NEVER_DRAFT_FOLDERS]).toEqual([
			'Outputs/The Tao of Rob',
			"Outputs/Rob's Hammer",
			'Outputs/The Diuniverse',
		]);
	});
});
