'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { saveReviewedImport } from '@/app/import-actions';
import { importStatusFor, parseNotes } from '@/lib/import';
import {
  type ImportMatchOutcome,
  importDuplicates,
  needsImportReview,
  type ReviewRow,
} from '@/lib/import-matching';
import type { ItemInput, ItemKind, LibraryItem, ProfileRow, SearchResult } from '@/types/library';
import ImportReviewRow from './ImportReviewRow';

type ReviewFilter = 'attention' | 'all' | 'matched' | 'skipped';

const Import = ({ items, profile }: { items: LibraryItem[]; profile: ProfileRow }) => {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [defaultKind, setDefaultKind] = useState<ItemKind | null>(null);
  const [autoMatch, setAutoMatch] = useState(true);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [bulkKind, setBulkKind] = useState<ItemKind | null>(null);

  const [pending, start] = useTransition();
  const [matching, setMatching] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const matchController = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => () => matchController.current?.abort(), []);

  const patch = (id: string, value: Partial<ReviewRow>) =>
    setRows((previous) =>
      importDuplicates(
        previous.map((row) => (row.id === id ? { ...row, ...value } : row)),
        items
      )
    );

  const matchRows = async (selection: ReviewRow[], autoLink = true) => {
    const selected = selection.filter((row) => !row.skip && (!autoLink || !row.metadata));

    if (!selected.length) return;

    const controller = new AbortController();

    matchController.current = controller;
    setMatching(true);
    setProgress({ completed: 0, total: selected.length });

    try {
      for (let index = 0; index < selected.length; index += 3) {
        if (controller.signal.aborted) break;

        const batch = selected.slice(index, index + 3);
        const batchController = new AbortController();
        const abortBatch = () => batchController.abort();
        const timeout = setTimeout(abortBatch, 45000);

        controller.signal.addEventListener('abort', abortBatch, { once: true });

        try {
          const response = await fetch('/api/import/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: batchController.signal,
            body: JSON.stringify({
              rows: batch.map(({ id, title, kind, uncertain, date_hint }) => ({
                id,
                title,
                kind,
                uncertain,
                date_hint,
              })),
              auto_link: autoLink,
            }),
          });
          const data = await response.json();

          if (!response.ok) throw new Error(data.error || 'Matching unavailable.');
          if (controller.signal.aborted) break;

          const outcomes = data.outcomes as ImportMatchOutcome[];

          setRows((previous) =>
            importDuplicates(
              previous.map((row) => {
                const outcome = outcomes.find((candidate) => candidate.id === row.id);

                if (!outcome) return row;

                const metadata = autoLink ? outcome.metadata : row.metadata;
                const kind = metadata?.kind ?? row.kind;

                return {
                  ...row,
                  ...outcome,
                  metadata,
                  kind,
                  status: importStatusFor(kind, row.status),
                  ambiguous: metadata ? false : row.ambiguous,
                  services: kind === 'game' ? [] : row.services,
                  error:
                    outcome.error ||
                    (!outcome.results.length
                      ? 'No match found. This title can be saved unmatched.'
                      : !outcome.metadata && autoLink
                        ? 'Choose the right result, or keep this title unmatched.'
                        : ''),
                };
              }),
              items
            )
          );
        } catch (cause) {
          if (controller.signal.aborted) break;

          const error = batchController.signal.aborted
            ? 'Matching took too long. Retry or keep these titles unmatched.'
            : cause instanceof Error
              ? cause.message
              : 'Matching unavailable. Retry or keep unmatched.';

          setRows((previous) =>
            previous.map((row) =>
              batch.some((candidate) => candidate.id === row.id) ? { ...row, error } : row
            )
          );
        } finally {
          clearTimeout(timeout);
          controller.signal.removeEventListener('abort', abortBatch);
        }

        setProgress({
          completed: Math.min(index + batch.length, selected.length),
          total: selected.length,
        });
      }
    } finally {
      if (matchController.current === controller) {
        matchController.current = null;
        setMatching(false);
      }
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

      patch(row.id, {
        metadata: data.metadata,
        kind: result.kind,
        status: importStatusFor(result.kind, row.status),
        services: result.kind === 'game' ? [] : row.services,
        ambiguous: false,
        uncertain: false,
        error: '',
      });
    } catch (cause) {
      patch(row.id, { error: cause instanceof Error ? cause.message : 'Could not load details.' });
    }
  };

  const reviewNotes = () => {
    const parsed = parseNotes(notes, items, defaultKind);

    if (parsed.length > 200) {
      setError('Please import at most 200 titles at a time.');

      return;
    }
    if (!parsed.length) {
      setError('No titles found. Paste one title per line.');

      return;
    }

    const review: ReviewRow[] = parsed.map((row) => ({
      ...row,
      skip: row.duplicate,
      results: [],
      metadata: null,
      error: '',
    }));

    setRows(review);
    setReviewing(true);
    setFilter(autoMatch ? 'attention' : 'all');
    setError('');
    setMessage('');

    if (autoMatch) void matchRows(review);
  };

  const save = async (selected: ReviewRow[]) => {
    setError('');
    setMessage('');

    if (selected.some((row) => !row.kind)) {
      setError(
        'Choose a type for the remaining titles, use the bulk type setting, or import only ready titles.'
      );
      setFilter('attention');

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
                (platform) => !row.metadata || row.metadata.fields.platforms.includes(platform)
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

      setRows((previous) =>
        previous
          .filter((row) => !result.saved.includes(row.id))
          .map((row) => ({
            ...row,
            error: result.errors.find((failure) => failure.key === row.id)?.error ?? row.error,
          }))
      );
      setMessage(
        `${result.saved.length} ${result.saved.length === 1 ? 'title' : 'titles'} imported.`
      );

      if (result.errors.length) {
        setError(
          'Some titles could not be saved. They remain below for correction; saved titles will not be retried.'
        );
        setFilter('attention');
      }

      router.refresh();
    } catch {
      setError('Import interrupted. Check your library before retrying to avoid duplicates.');
    }
  };

  const busy = pending || matching;
  const selected = rows.filter((row) => !row.skip);
  const attention = rows.filter(needsImportReview);
  const ready = selected.filter((row) => !needsImportReview(row));
  const skipped = rows.filter((row) => row.skip);
  const untyped = selected.filter((row) => !row.kind);
  const visible =
    filter === 'attention'
      ? attention
      : filter === 'matched'
        ? ready
        : filter === 'skipped'
          ? skipped
          : rows;

  return (
    <>
      <header className="pageHeading">
        <div>
          <span className="eyebrow">From your notes to your next night in</span>
          <h1>Bring your list along.</h1>
          <p>
            Paste your notes. We’ll find matches so you can focus on the titles that need a
            decision.
          </p>
        </div>
      </header>
      {!reviewing ? (
        <section className="importPaste">
          <div className="importOptions">
            <label>
              Default type
              <select
                value={defaultKind ?? ''}
                onChange={(e) => setDefaultKind((e.target.value || null) as ItemKind | null)}
              >
                <option value="">Mixed list — detect automatically</option>
                <option value="movie">Movies</option>
                <option value="show">TV series</option>
                <option value="game">Games</option>
              </select>
            </label>
            <p className="hint">
              Set a type once for your whole list. Movies, TV series, and Games headings can still
              set a different type for a section.
            </p>
          </div>
          <label>
            Your notes
            <textarea
              rows={16}
              maxLength={50000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                'Dune (2021)\nThe Sandman\nHades II\n\nOr paste notes with headings such as Movies, Netflix, or Playing now.'
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoMatch}
              onChange={(e) => setAutoMatch(e.target.checked)}
            />
            Find and link clear matches automatically
          </label>
          <p className="hint">
            Paste one title per line. Add a year in brackets to distinguish versions. Uncertain
            matches stay for review, duplicates are skipped, and nothing is saved until you confirm.
          </p>
          <button
            type="button"
            className="primary"
            disabled={!notes.trim() || busy}
            onClick={reviewNotes}
          >
            {autoMatch ? 'Find and review titles' : 'Review titles'}
          </button>
        </section>
      ) : (
        <>
          <div className="sectionHeading">
            <h2>
              {rows.length} {rows.length === 1 ? 'title' : 'titles'} to review
            </h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setReviewing(false);
                setRows([]);
                setError('');
                setMessage('');
              }}
            >
              Start over
            </button>
          </div>
          <div className="importReviewTools">
            <p className="hint" role="status">
              {matching
                ? `Matching ${progress.completed} of ${progress.total} titles…`
                : `${ready.length} ready · ${attention.length} need attention · ${skipped.length} skipped`}
            </p>
            {matching && (
              <div className="inline">
                <progress
                  aria-label="Title matching progress"
                  value={progress.completed}
                  max={progress.total}
                />
                <button type="button" onClick={() => matchController.current?.abort()}>
                  Stop matching
                </button>
              </div>
            )}
            <fieldset className="importReviewFilters" aria-label="Filter imported titles">
              {(
                [
                  ['attention', `Needs attention (${attention.length})`],
                  ['matched', `Ready (${ready.length})`],
                  ['all', `All titles (${rows.length})`],
                  ['skipped', `Skipped (${skipped.length})`],
                ] as const
              ).map(([value, name]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {name}
                </button>
              ))}
            </fieldset>
            {untyped.length > 0 && (
              <div className="importBulkType">
                <label>
                  Type for remaining titles
                  <select
                    disabled={busy}
                    value={bulkKind ?? ''}
                    onChange={(e) => setBulkKind((e.target.value || null) as ItemKind | null)}
                  >
                    <option value="">Choose a type…</option>
                    <option value="movie">Movies</option>
                    <option value="show">TV series</option>
                    <option value="game">Games</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !bulkKind}
                  onClick={() => {
                    setRows((previous) =>
                      importDuplicates(
                        previous.map((row) =>
                          row.skip || row.kind
                            ? row
                            : {
                                ...row,
                                kind: bulkKind,
                                status: importStatusFor(bulkKind, row.status),
                                services: bulkKind === 'game' ? [] : row.services,
                                results: [],
                                error: '',
                                ambiguous: row.uncertain,
                              }
                        ),
                        items
                      )
                    );
                  }}
                >
                  Apply to {untyped.length} {untyped.length === 1 ? 'title' : 'titles'}
                </button>
              </div>
            )}
            <div className="inline">
              <p className="hint">
                Clear matches are ready to import. You can edit any title or import typed titles
                without a match.
              </p>
              <button
                type="button"
                disabled={busy || !selected.some((row) => !row.metadata)}
                onClick={() => void matchRows(rows)}
              >
                Match remaining titles
              </button>
            </div>
          </div>
          {!visible.length && (
            <p className="hint">
              {matching
                ? 'Matching your list. Titles needing a decision will appear here.'
                : filter === 'attention'
                  ? 'No titles need attention. Your matched titles are ready to import.'
                  : 'No titles in this view.'}
            </p>
          )}
          {visible.map((row) => (
            <ImportReviewRow
              key={row.id}
              row={row}
              disabled={busy}
              patch={patch}
              suggest={(row) => void matchRows([row], false)}
              link={(row, result) => start(() => link(row, result))}
            />
          ))}
          <div className="formActions">
            <button
              type="button"
              className="primary"
              disabled={busy || !selected.length}
              onClick={() => start(() => save(selected))}
            >
              {pending
                ? 'Working through your list…'
                : `Import ${selected.length} ${selected.length === 1 ? 'title' : 'titles'}`}
            </button>
            {attention.length > 0 && ready.length > 0 && (
              <button type="button" disabled={busy} onClick={() => start(() => save(ready))}>
                Import {ready.length} ready {ready.length === 1 ? 'title' : 'titles'}
              </button>
            )}
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
