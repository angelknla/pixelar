import type { LibraryItem, MetadataRow, SearchResult } from '@/types/library';
import { parseNotes } from './import';
import {
  confidentImportMatch,
  type ImportMatchInput,
  importDuplicates,
  importSearchHint,
  type ReviewRow,
} from './import-matching';
import { EMPTY_FIELDS } from './library';

const row: ImportMatchInput = {
  id: 'one',
  title: 'Dune',
  kind: null,
  uncertain: false,
  date_hint: null,
};
const result: SearchResult = {
  provider: 'tmdb',
  provider_id: '1',
  kind: 'movie',
  title: 'Dune',
  artwork: null,
  year: '2021',
};

it('links only a unique exact title and keeps remakes, cross-type collisions, and uncertainty for review', () => {
  expect(confidentImportMatch(row, [result])).toEqual(result);
  expect(
    confidentImportMatch(row, [result, { ...result, provider_id: '2', year: '1984' }])
  ).toBeNull();
  expect(confidentImportMatch(row, [result, { ...result, kind: 'show' }])).toBeNull();
  expect(confidentImportMatch({ ...row, uncertain: true }, [result])).toBeNull();
  expect(confidentImportMatch(row, [{ ...result, title: 'Dune: Part Two' }])).toBeNull();
  expect(confidentImportMatch({ ...row, kind: 'game' }, [result])).toBeNull();
});

it('uses an explicit year to distinguish remakes without using a partial date hint', () => {
  const results = [result, { ...result, provider_id: '2', year: '1984' }];

  expect(importSearchHint({ title: 'Dune (2021)', date_hint: null })).toEqual({
    query: 'Dune',
    year: '2021',
  });
  expect(confidentImportMatch({ ...row, title: 'Dune (2021)' }, results)).toEqual(result);
  expect(confidentImportMatch({ ...row, date_hint: 'October 22nd 2021' }, results)).toEqual(result);
  expect(confidentImportMatch({ ...row, date_hint: 'October 22nd' }, results)).toBeNull();
  expect(confidentImportMatch({ ...row, title: 'Dune (2025)' }, results)).toBeNull();
});

it('normalises punctuation and case but preserves sequel numbers', () => {
  expect(
    confidentImportMatch({ ...row, title: 'SPIDER-MAN' }, [{ ...result, title: 'Spider Man' }])
  ).toEqual({ ...result, title: 'Spider Man' });
  expect(
    confidentImportMatch({ ...row, title: 'Hades II' }, [{ ...result, title: 'Hades' }])
  ).toBeNull();
});

it('detects duplicates after a type or catalogue link is resolved, including custom library titles', () => {
  const metadata = {
    id: 'cached',
    provider: 'tmdb',
    provider_id: '1',
    kind: 'movie',
    fields: { ...EMPTY_FIELDS, title: 'Dune' },
  } as MetadataRow;
  const review: ReviewRow[] = parseNotes('Dune (2021)\nDune', [], 'movie').map((parsed) => ({
    ...parsed,
    skip: false,
    results: [],
    metadata,
    error: '',
  }));
  const existing = [
    { kind: 'movie', fields: { ...EMPTY_FIELDS, title: 'My favourite' }, metadata },
  ] as LibraryItem[];

  expect(importDuplicates(review, []).map((entry) => [entry.duplicate, entry.skip])).toEqual([
    [false, false],
    [true, true],
  ]);
  expect(importDuplicates(review, existing).every((entry) => entry.skip)).toBe(true);
});

it('keeps distinct catalogue entries with the same title', () => {
  const metadata = {
    id: 'cached',
    provider: 'tmdb',
    provider_id: '1',
    kind: 'movie',
    fields: { ...EMPTY_FIELDS, title: 'Dune' },
  } as MetadataRow;
  const review: ReviewRow[] = parseNotes('Dune (2021)\nDune (1984)', [], 'movie').map(
    (parsed, index) => ({
      ...parsed,
      skip: false,
      results: [],
      metadata: { ...metadata, provider_id: String(index + 1) },
      error: '',
    })
  );

  expect(importDuplicates(review, []).map((entry) => entry.skip)).toEqual([false, false]);
});
