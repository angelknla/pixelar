import { importStatusFor } from '@/lib/import';
import {
  importKindLabel,
  needsImportReview,
  type ReviewRow,
  resultKey,
} from '@/lib/import-matching';
import { label, releaseLabel, statusesFor } from '@/lib/library';
import type { ItemKind, SearchResult, Status } from '@/types/library';

interface ImportReviewRowProps {
  row: ReviewRow;
  disabled: boolean;
  patch: (id: string, value: Partial<ReviewRow>) => void;
  suggest: (row: ReviewRow) => void;
  link: (row: ReviewRow, result: SearchResult) => void;
}

const ImportReviewRow = ({ row, disabled, patch, suggest, link }: ImportReviewRowProps) => {
  const needsReview = needsImportReview(row);
  const state = row.skip ? 'Skipped' : row.metadata ? 'Matched' : 'Unmatched';

  return (
    <section className={`importRow ${row.skip ? 'skipped' : ''}`} aria-label={row.title}>
      <div className="importRowHeading">
        <label className="checkbox">
          <input
            type="checkbox"
            disabled={disabled}
            checked={!row.skip}
            onChange={(e) => patch(row.id, { skip: !e.target.checked })}
          />
          Import this title
        </label>
        <span className="hint">
          {row.duplicate
            ? 'Already in your library or this paste'
            : needsReview
              ? 'Needs your review'
              : state}
        </span>
      </div>
      <details open={needsReview}>
        <summary className="importRowSummary">
          <strong>{row.title}</strong>
          <span className="hint">
            {importKindLabel(row.kind)} · {label(row.status)}
            {row.metadata?.fields.release_date
              ? ` · ${row.metadata.fields.release_date.slice(0, 4)}`
              : ''}
          </span>
        </summary>
        <div className="importRowDetails">
          <div className="importFields">
            <label>
              Title
              <input
                disabled={disabled || row.skip}
                value={row.title}
                onChange={(e) =>
                  patch(row.id, {
                    title: e.target.value,
                    metadata: null,
                    results: [],
                    error: '',
                    ambiguous:
                      !row.kind ||
                      /[?]/.test(e.target.value) ||
                      /\b(or|maybe|tbc)\b/i.test(e.target.value),
                    uncertain:
                      /[?]/.test(e.target.value) || /\b(or|maybe|tbc)\b/i.test(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Type
              <select
                disabled={disabled || row.skip}
                value={row.kind ?? ''}
                onChange={(e) => {
                  const kind = (e.target.value || null) as ItemKind | null;

                  patch(row.id, {
                    kind,
                    status: importStatusFor(kind, row.status),
                    services: kind === 'game' ? [] : row.services,
                    metadata: null,
                    results: [],
                    error: '',
                    ambiguous: row.uncertain || !kind,
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
                disabled={disabled || row.skip || !row.kind}
                value={row.status}
                onChange={(e) => patch(row.id, { status: e.target.value as Status })}
              >
                {statusesFor(row.kind ?? 'movie').map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {row.kind && row.kind !== 'game' && (
            <label>
              Services (comma-separated)
              <input
                disabled={disabled || row.skip}
                value={row.services.join(', ')}
                onChange={(e) =>
                  patch(row.id, {
                    services: e.target.value
                      .split(',')
                      .map((service) => service.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          )}
          {row.date_hint && (
            <p className="hint">
              Your notes: {row.date_hint}.{' '}
              {row.metadata
                ? `Fetched release: ${releaseLabel(row.metadata.fields)}. Review any disagreement before importing.`
                : 'Choose a match to fetch its release year and date.'}
            </p>
          )}
          <div className="inline">
            <button
              type="button"
              disabled={disabled || row.skip || !row.title.trim()}
              onClick={() => suggest(row)}
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
                  disabled={disabled || row.skip}
                  onClick={() => patch(row.id, { title: row.metadata!.fields.title })}
                >
                  Use matched title
                </button>
                <button
                  type="button"
                  className="textButton"
                  disabled={disabled || row.skip}
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
                value={row.metadata ? resultKey(row.metadata) : ''}
                disabled={disabled}
                onChange={(e) => {
                  const result = row.results.find(
                    (candidate) => resultKey(candidate) === e.target.value
                  );

                  if (result) link(row, result);
                  else patch(row.id, { metadata: null });
                }}
              >
                <option value="">Keep unmatched</option>
                {row.results.map((result) => (
                  <option key={resultKey(result)} value={resultKey(result)}>
                    {result.title}
                    {result.year ? ` (${result.year})` : ''} · {importKindLabel(result.kind)}
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
        </div>
      </details>
    </section>
  );
};

export default ImportReviewRow;
