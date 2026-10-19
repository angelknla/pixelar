'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveReviewedImport } from '@/app/import-actions';
import { type ImportRow, parseNotes } from '@/lib/import';
import { label, releaseLabel, statusesFor } from '@/lib/library';
import type {
  ItemInput,
  ItemKind,
  LibraryItem,
  MetadataRow,
  ProfileRow,
  SearchResult,
  Status,
} from '@/types/library';

interface ReviewRow extends ImportRow {
  skip: boolean;
  results: SearchResult[];
  metadata: MetadataRow | null;
  error: string;
}

const Import = ({ items, profile }: { items: LibraryItem[]; profile: ProfileRow }) => {
  const router = useRouter();

  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);

  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const patch = (id: string, value: Partial<ReviewRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...value } : r)));

  const suggest = async (row: ReviewRow) => {
    if (!row.kind) return;

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(row.title)}&kind=${row.kind}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      patch(row.id, {
        results: data.results,
        error: data.results.length ? '' : 'No match found. This title can be saved unmatched.',
      });
    } catch (e) {
      patch(row.id, { error: e instanceof Error ? e.message : 'Search unavailable.' });
    }
  };

  const link = async (row: ReviewRow, result: SearchResult) => {
    try {
      const response = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      patch(row.id, { metadata: data.metadata, error: '' });
    } catch (e) {
      patch(row.id, { error: e instanceof Error ? e.message : 'Could not load details.' });
    }
  };

  return (
    <>
      <header className="pageHeading">
        <div>
          <span className="eyebrow">From your notes to your next night in</span>
          <h1>Bring your list along.</h1>
          <p>Paste your notes, check the titles, and give them a new home.</p>
        </div>
      </header>
      {!reviewing ? (
        <section className="importPaste">
          <label>
            Your notes
            <textarea
              rows={16}
              maxLength={50000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                'Anticipated Games\n• Kemuri?\n\nPlaying now\n• Hades II\n\nNetflix\n• The Sandman'
              }
            />
          </label>
          <p className="hint">
            Headings such as Netflix, HBO, Playing now, and Anticipated Games set helpful defaults.
            Nothing is saved until you review and confirm.
          </p>
          <button
            type="button"
            className="primary"
            disabled={!notes.trim() || pending}
            onClick={() => {
              const parsed = parseNotes(notes, items);

              if (parsed.length > 200) {
                setError('Please import at most 200 titles at a time.');

                return;
              }

              if (!parsed.length) {
                setError('No titles found. Add a title below a heading.');

                return;
              }

              const review = parsed.map((r) => ({
                ...r,
                skip: r.duplicate,
                results: [],
                metadata: null,
                error: '',
              }));

              setRows(review);
              setReviewing(true);
              setError('');
            }}
          >
            Review titles
          </button>
        </section>
      ) : (
        <>
          <div className="sectionHeading">
            <h2>{rows.length} titles to review</h2>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setReviewing(false);
                setRows([]);
              }}
            >
              Start over
            </button>
          </div>
          <p className="hint">
            Find matches for the titles you want to link, then confirm each match. Unclear lines
            stay unmatched. Change any type, status, service or title below; use the item editor
            after import for other details.
          </p>
          {rows.map((row) => (
            <section className={`importRow ${row.skip ? 'skipped' : ''}`} key={row.id}>
              <div className="importRowHeading">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={!row.skip}
                    onChange={(e) => patch(row.id, { skip: !e.target.checked })}
                  />
                  Import this title
                </label>
                <span className="hint">
                  {row.duplicate
                    ? 'Already in your library or this paste'
                    : row.ambiguous
                      ? 'Needs your review'
                      : ''}
                </span>
              </div>
              <div className="importFields">
                <label>
                  Title
                  <input
                    disabled={row.skip}
                    value={row.title}
                    onChange={(e) =>
                      patch(row.id, { title: e.target.value, metadata: null, results: [] })
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    disabled={row.skip}
                    value={row.kind ?? ''}
                    onChange={(e) => {
                      const kind = e.target.value as ItemKind;

                      patch(row.id, {
                        kind,
                        status: kind === 'game' ? 'backlog' : 'watchlist',
                        services: kind === 'game' ? [] : row.services,
                        metadata: null,
                        results: [],
                      });
                    }}
                  >
                    <option value="">Choose a type…</option>
                    <option value="game">Game</option>
                    <option value="movie">Movie</option>
                    <option value="show">TV series</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    disabled={row.skip || !row.kind}
                    value={row.status}
                    onChange={(e) => patch(row.id, { status: e.target.value as Status })}
                  >
                    {statusesFor(row.kind ?? 'game').map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {row.kind && row.kind !== 'game' && (
                <label>
                  Services (comma-separated)
                  <input
                    disabled={row.skip}
                    value={row.services.join(', ')}
                    onChange={(e) =>
                      patch(row.id, {
                        services: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              )}
              {row.date_hint && (
                <p className="hint">
                  Your notes: {row.date_hint} (year unconfirmed).{' '}
                  {row.metadata
                    ? `Fetched release: ${releaseLabel(row.metadata.fields)}. Review any disagreement before importing.`
                    : 'Select a match to fetch its release year and date.'}
                </p>
              )}
              <div className="inline">
                <button
                  type="button"
                  disabled={pending || row.skip || !row.kind}
                  onClick={() => start(() => suggest(row))}
                >
                  Find matches
                </button>
                <span className="hint">
                  {row.metadata
                    ? `Linked: ${row.metadata.fields.title}`
                    : 'Unmatched — will keep your title'}
                </span>
                {row.metadata && (
                  <>
                    <button
                      type="button"
                      className="textButton"
                      onClick={() => patch(row.id, { title: row.metadata!.fields.title })}
                    >
                      Use matched title
                    </button>
                    <button
                      className="textButton"
                      type="button"
                      onClick={() => patch(row.id, { metadata: null })}
                    >
                      Remove match
                    </button>
                  </>
                )}
              </div>
              {!row.skip && row.results.length > 0 && (
                <label>
                  Choose a result
                  <select
                    value={row.metadata?.provider_id ?? ''}
                    disabled={pending}
                    onChange={(e) => {
                      const result = row.results.find((r) => r.provider_id === e.target.value);

                      if (result) start(() => link(row, result));
                      else patch(row.id, { metadata: null });
                    }}
                  >
                    <option value="">Keep unmatched</option>
                    {row.results.map((r) => (
                      <option key={r.provider_id} value={r.provider_id}>
                        {r.title}
                        {r.year ? ` (${r.year})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {row.error && (
                <p className="hint" role="status">
                  {row.error}
                </p>
              )}
            </section>
          ))}
          <div className="formActions">
            <button
              type="button"
              className="primary"
              disabled={pending || rows.every((r) => r.skip)}
              onClick={() => {
                setError('');
                setMessage('');
                start(async () => {
                  const selected = rows.filter((r) => !r.skip);

                  if (selected.some((r) => !r.kind)) {
                    setError('Choose a type for every title you want to import.');

                    return;
                  }

                  const values = selected.map((row) => {
                    const item: ItemInput = {
                      kind: row.kind!,
                      status: row.status,
                      metadata_id: row.metadata?.id ?? null,
                      overrides: { title: row.title },
                      platforms:
                        row.kind === 'game'
                          ? profile.platforms.filter(
                              (p) => !row.metadata || row.metadata.fields.platforms.includes(p)
                            )
                          : [],
                      services: row.kind === 'game' ? [] : row.services,
                      price: null,
                      currency: profile.currency,
                      notes: row.date_hint
                        ? `Original release hint: ${row.date_hint}. Imported from: ${row.source}`
                        : '',
                      auto_move: true,
                      reminder_days: profile.default_release_reminder ? [0] : [],
                    };

                    return { key: row.id, item };
                  });

                  try {
                    const result = await saveReviewedImport(values);

                    setRows((prev) =>
                      prev
                        .filter((r) => !result.saved.includes(r.id))
                        .map((r) => ({
                          ...r,
                          error: result.errors.find((e) => e.key === r.id)?.error ?? r.error,
                        }))
                    );
                    setMessage(`${result.saved.length} titles imported.`);

                    if (result.errors.length)
                      setError(
                        'Some titles could not be saved. They remain below for correction; saved titles will not be retried.'
                      );

                    router.refresh();
                  } catch {
                    setError(
                      'Import interrupted. Check your library before retrying to avoid duplicates.'
                    );
                  }
                });
              }}
            >
              {pending
                ? 'Working through your list…'
                : `Import ${rows.filter((r) => !r.skip).length} titles`}
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="errorMessage">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="successMessage">
          {message}
        </p>
      )}
    </>
  );
};

export default Import;
