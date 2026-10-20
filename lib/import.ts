import type { ItemKind, LibraryItem, Status } from '@/types/library';
import { statusesFor } from './library';

export interface ImportRow {
  id: string;
  source: string;
  title: string;
  kind: ItemKind | null;
  status: Status;
  services: string[];
  duplicate: boolean;
  ambiguous: boolean;
  uncertain: boolean;
  date_hint: string | null;
}

const headings: Record<string, { kind?: ItemKind; status?: Status; service?: string }> = {
  games: { kind: 'game', status: 'backlog' },
  'anticipated games': { kind: 'game', status: 'anticipated' },
  'anticipated game titles': { kind: 'game', status: 'anticipated' },
  'scheduled release calendar': { status: 'scheduled' },
  'playing now': { kind: 'game', status: 'playing' },
  'available and replay titles': { kind: 'game', status: 'backlog' },
  'available titles': { kind: 'game', status: 'backlog' },
  replay: { kind: 'game', status: 'replay' },
  completed: { kind: 'game', status: 'completed' },
  screen: { kind: 'show', status: 'watchlist' },
  streaming: { kind: 'show', status: 'watchlist' },
  movies: { kind: 'movie', status: 'watchlist' },
  films: { kind: 'movie', status: 'watchlist' },
  series: { kind: 'show', status: 'watchlist' },
  'tv series': { kind: 'show', status: 'watchlist' },
  'tv shows': { kind: 'show', status: 'watchlist' },
  'watching now': { kind: 'show', status: 'watching' },
  upcoming: { status: 'upcoming' },
  netflix: { kind: 'show', service: 'Netflix', status: 'watchlist' },
  prime: { kind: 'show', service: 'Prime Video', status: 'watchlist' },
  'prime video': { kind: 'show', service: 'Prime Video', status: 'watchlist' },
  hbo: { kind: 'show', service: 'HBO', status: 'watchlist' },
  'apple tv': { kind: 'show', service: 'Apple TV', status: 'watchlist' },
  'apple tv+': { kind: 'show', service: 'Apple TV', status: 'watchlist' },
  'disney+': { kind: 'show', service: 'Disney+', status: 'watchlist' },
  'bbc iplayer': { kind: 'show', service: 'BBC iPlayer', status: 'watchlist' },
};

const serviceNames: Record<string, string> = {
  netflix: 'Netflix',
  prime: 'Prime Video',
  'prime video': 'Prime Video',
  hbo: 'HBO',
  'apple tv': 'Apple TV',
  'apple tv+': 'Apple TV',
  'disney+': 'Disney+',
};

const months =
  'January|February|March|April|May|June|July|August|September|October|November|December';
const datePrefix = new RegExp(
  `^((?:${months})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+\\d{4})?)\\s+(.+)$`,
  'i'
);

export const titleKey = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const importStatusFor = (kind: ItemKind | null, status: Status): Status => {
  if (!kind || statusesFor(kind).includes(status)) return status;
  if (kind === 'game') return status === 'upcoming' ? 'anticipated' : 'backlog';

  return status === 'scheduled' || status === 'anticipated' ? 'upcoming' : 'watchlist';
};

export const parseNotes = (
  notes: string,
  existing: Pick<LibraryItem, 'fields' | 'kind'>[] = [],
  defaultKind: ItemKind | null = null
): ImportRow[] => {
  const rows: ImportRow[] = [];

  let kind: ItemKind | null = defaultKind,
    status: Status = defaultKind === 'game' ? 'backlog' : 'watchlist',
    services: string[] = [];

  let uncertain = false;
  const seen = new Set(existing.map((i) => `${i.kind}:${titleKey(i.fields.title)}`));
  // Movie lists often precede the service-grouped TV list, as in the user's notes.
  const openingMovieList = notes
    .split(/\r?\n/)
    .some((line) => /\s[-–]\s*(Netflix|Prime|Apple TV)\s*$/i.test(line));

  if (openingMovieList && !defaultKind) kind = 'movie';

  for (const raw of notes.split(/\r?\n/)) {
    const source = raw.trim();

    if (!source || /^[-_=]{3,}$/.test(source) || /^Sent from\s/i.test(source)) continue;

    const line = source.replace(/^(?:[-*•–]\s*|\d+[.)]\s+|\[[ xX]\]\s*)/, '').trim();
    const heading = line
      .replace(/^#+\s*/, '')
      .replace(/:$/, '')
      .toLowerCase();

    if (headings[heading]) {
      const hint = headings[heading];

      kind = (hint.service ? defaultKind : null) ?? hint.kind ?? kind;
      status = hint.status ?? status;
      services = hint.service ? [hint.service] : [];
      uncertain = heading === 'available and replay titles';
      continue;
    }

    if (/:$/.test(line) || /^#/.test(line)) {
      kind = defaultKind;
      services = [];
      uncertain = true;
      continue;
    }

    let title = line;
    let rowServices = [...services];
    let rowStatus = status;
    let dateHint: string | null = null;
    let rowUncertain = uncertain;
    const suffix = title.match(/\s[-–]\s*(Netflix|Prime(?: Video)?|HBO|Apple TV\+?|Disney\+)\s*$/i);

    if (suffix) {
      rowServices = [serviceNames[suffix[1].toLowerCase()]];
      title = title.slice(0, suffix.index).trim();
    }

    const dated = title.match(datePrefix);

    if (dated) {
      dateHint = dated[1];
      title = dated[2];
    }

    if (kind === 'game') {
      if (/^Re(?:\s|:\s*)/i.test(title)) {
        title = title.replace(/^Re(?:\s|:\s*)/i, '');
        rowStatus = 'replay';
        rowUncertain = false;
      } else if (/^Out\s+/i.test(title)) {
        title = title.replace(/^Out\s+/i, '');
        rowStatus = 'backlog';
        rowUncertain = false;
      }
    }

    title = title.slice(0, 300);

    const key = kind ? `${kind}:${titleKey(title)}` : `unknown:${titleKey(title)}`;
    const needsReview = rowUncertain || /[?]/.test(title) || /\b(or|maybe|tbc)\b/i.test(title);

    rows.push({
      id: `line-${rows.length}`,
      source,
      title,
      kind,
      status: importStatusFor(kind, rowStatus),
      services: rowServices,
      duplicate: seen.has(key),
      ambiguous: needsReview || !kind,
      uncertain: needsReview,
      date_hint: dateHint,
    });
    seen.add(key);
  }

  return rows;
};
