import type { ItemKind, LibraryItem, MetadataRow, SearchResult } from '@/types/library';
import type { ImportRow } from './import';
import { titleKey } from './import';

export type ImportMatchInput = Pick<ImportRow, 'id' | 'title' | 'kind' | 'uncertain' | 'date_hint'>;

export interface ImportMatchOutcome {
  id: string;
  results: SearchResult[];
  metadata: MetadataRow | null;
  error: string;
}

export interface ReviewRow extends ImportRow {
  skip: boolean;
  results: SearchResult[];
  metadata: MetadataRow | null;
  error: string;
}

export const importSearchHint = (row: Pick<ImportRow, 'title' | 'date_hint'>) => {
  const suffix = row.title.match(/\s*\(((?:19|20)\d{2})\)\s*$/);

  return {
    query: suffix ? row.title.slice(0, suffix.index).trim() : row.title.trim(),
    year: suffix?.[1] ?? row.date_hint?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null,
  };
};

export const resultKey = (result: Pick<SearchResult, 'provider' | 'kind' | 'provider_id'>) =>
  `${result.provider}:${result.kind}:${result.provider_id}`;

export const confidentImportMatch = (
  row: ImportMatchInput,
  results: SearchResult[]
): SearchResult | null => {
  if (row.uncertain) return null;

  const { query, year } = importSearchHint(row);
  const matches = results.filter(
    (result) =>
      (!row.kind || result.kind === row.kind) &&
      titleKey(result.title) === titleKey(query) &&
      (!year || result.year === year)
  );
  const unique = [...new Map(matches.map((result) => [resultKey(result), result])).values()];

  return unique.length === 1 ? unique[0] : null;
};

export const needsImportReview = (row: ReviewRow) =>
  !row.skip && (!row.kind || !row.metadata || row.ambiguous || Boolean(row.error));

export const importDuplicates = (rows: ReviewRow[], items: LibraryItem[]): ReviewRow[] => {
  const titles = new Set(items.map((item) => `${item.kind}:${titleKey(item.fields.title)}`));
  const manualTitles = new Set(
    items
      .filter((item) => !item.metadata)
      .map((item) => `${item.kind}:${titleKey(item.fields.title)}`)
  );
  const sources = new Set(
    items.flatMap((item) => (item.metadata ? [resultKey(item.metadata)] : []))
  );

  return rows.map((row) => {
    const title = row.metadata?.fields.title ?? row.title;
    const key = `${row.kind}:${titleKey(title)}`;
    const source = row.metadata ? resultKey(row.metadata) : null;
    const duplicate = source ? sources.has(source) || manualTitles.has(key) : titles.has(key);

    if (row.kind) titles.add(key);
    if (row.kind && !source) manualTitles.add(key);
    if (source) sources.add(source);

    return { ...row, duplicate, skip: row.skip || (duplicate && !row.duplicate) };
  });
};

export const importKindLabel = (kind: ItemKind | null) =>
  kind === 'game'
    ? 'Game'
    : kind === 'movie'
      ? 'Movie'
      : kind === 'show'
        ? 'TV series'
        : 'Choose a type';
