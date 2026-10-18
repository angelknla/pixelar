'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteItem, saveItem } from '@/app/library-actions';
import {
  EMPTY_FIELDS,
  effectiveFields,
  label,
  PLATFORMS,
  releaseLabel,
  SERVICES,
  statusesFor,
} from '@/lib/library';
import type {
  ItemKind,
  LibraryItem,
  MetadataFields,
  MetadataRow,
  Precision,
  ProfileRow,
  SearchResult,
  Status,
} from '@/types/library';
import Artwork from './Artwork';

type Props = {
  kind: ItemKind;
  profile: ProfileRow;
  item?: LibraryItem;
  reminderDays?: number[];
  onDone?: () => void;
  initialTitle?: string;
  initialStatus?: Status;
  initialServices?: string[];
};
export default function ItemEditor({
  kind: initialKind,
  profile,
  item,
  reminderDays,
  onDone,
  initialTitle = '',
  initialStatus,
  initialServices,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState(initialKind);
  const [metadata, setMetadata] = useState<MetadataRow | null>(item?.metadata ?? null);
  const [overrides, setOverrides] = useState<Partial<MetadataFields>>(
    item?.overrides ?? { title: initialTitle }
  );
  const [status, setStatus] = useState<Status>(
    item?.status ?? initialStatus ?? (initialKind === 'game' ? 'backlog' : 'watchlist')
  );
  const [platforms, setPlatforms] = useState(item?.platforms ?? profile.platforms);
  const [services, setServices] = useState(item?.services ?? initialServices ?? profile.services);
  const [price, setPrice] = useState(item?.price?.toString() ?? '');
  const [currency, setCurrency] = useState(item?.currency ?? profile.currency);
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [autoMove, setAutoMove] = useState(item?.auto_move ?? true);
  const [reminders, setReminders] = useState(
    (reminderDays ?? (profile.default_release_reminder ? [0] : [])).join(', ')
  );
  const [query, setQuery] = useState(item?.fields.title ?? initialTitle);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fields = effectiveFields(metadata?.fields ?? EMPTY_FIELDS, overrides);
  const patch = <K extends keyof MetadataFields>(key: K, value: MetadataFields[K]) =>
    setOverrides((prev) => ({ ...prev, [key]: value }));
  function restoreFetched(key: keyof MetadataFields) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }
  function finish() {
    router.refresh();
    if (onDone) onDone();
    else router.push(kind === 'game' ? '/games' : '/screen');
  }
  function run(work: () => Promise<void>) {
    setError('');
    setMessage('');
    start(async () => {
      try {
        await work();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    });
  }
  function load(result: SearchResult, refresh = false) {
    run(async () => {
      const response = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result, refresh, item_id: item?.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const cached = data.metadata as MetadataRow;
      setMetadata(cached);
      setResults([]);
      // A search typed into the add form is not a deliberate title override.
      if (!item && !metadata && overrides.title === initialTitle)
        setOverrides((prev) => {
          const next = { ...prev };
          delete next.title;
          return next;
        });
      if (!item && !metadata) {
        setPlatforms(profile.platforms.filter((p) => cached.fields.platforms.includes(p)));
        setServices(profile.services.filter((s) => cached.fields.services.includes(s)));
      }
      setMessage(
        refresh
          ? 'Fetched values refreshed. Your edits are preserved. Save to confirm changes.'
          : 'Linked result. Check the details and your platform or services, then save.'
      );
    });
  }
  function submit() {
    run(async () => {
      const parsedReminders = reminders.trim()
        ? reminders.split(',').map((s) => Number(s.trim()))
        : [];
      const result = await saveItem({
        ...(item ? { id: item.id } : {}),
        kind,
        status,
        metadata_id: metadata?.id ?? null,
        overrides,
        platforms,
        services,
        price: price === '' ? null : Number(price),
        currency,
        notes,
        auto_move: autoMove,
        reminder_days: parsedReminders,
      });
      if (result.error) throw new Error(result.error);
      finish();
    });
  }
  const resetButton = (key: keyof MetadataFields) =>
    metadata && key in overrides ? (
      <button className="textButton" type="button" onClick={() => restoreFetched(key)}>
        Use fetched value
      </button>
    ) : null;
  const choose = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  return (
    <div className="editor">
      <div className="editorHeading">
        <div>
          <span className="eyebrow">{item ? 'Make it yours' : 'A new adventure'}</span>
          <h2>{item ? 'Edit title' : 'Add to your library'}</h2>
        </div>
        {onDone && (
          <button type="button" aria-label="Close editor" onClick={onDone}>
            ✕
          </button>
        )}
      </div>
      {!item && initialKind !== 'game' && (
        <label>
          Type
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ItemKind);
              setMetadata(null);
              setResults([]);
            }}
          >
            <option value="movie">Movie</option>
            <option value="show">TV show</option>
          </select>
        </label>
      )}
      <div className="searchBox">
        <label>
          Find a {kind === 'game' ? 'game' : kind === 'show' ? 'TV show' : 'movie'}
          <div className="inline">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a title…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.getElementById('searchTitles')?.click();
                }
              }}
            />
            <button
              id="searchTitles"
              type="button"
              disabled={pending || query.trim().length < 2}
              onClick={() =>
                run(async () => {
                  const response = await fetch(
                    `/api/search?q=${encodeURIComponent(query)}&kind=${kind}`
                  );
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  setResults(data.results);
                  if (!data.results.length) setMessage('No matches. Add a title manually below.');
                })
              }
            >
              Search
            </button>
          </div>
        </label>
        <p className="hint">Or enter just a title below. You can link it to a match later.</p>
      </div>
      {results.length > 0 && (
        <div className="searchResults">
          {results.map((result) => (
            <button
              type="button"
              className="searchResult"
              key={`${result.provider}:${result.provider_id}`}
              onClick={() => load(result)}
              disabled={pending}
            >
              <Artwork url={result.artwork} title={result.title} kind={kind} />
              <span>
                <strong>{result.title}</strong>
                <small>{result.year ?? 'Date unknown'}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {metadata && (
        <div className="metadataInfo">
          <span>
            Linked to{' '}
            <a href={metadata.fields.source_url} target="_blank" rel="noreferrer">
              {metadata.provider === 'rawg' ? 'RAWG' : 'TMDB'}
            </a>{' '}
            · fetched {new Date(metadata.fetched_at).toLocaleDateString('en-GB')}
          </span>
          {item && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                load(
                  {
                    provider: metadata.provider,
                    provider_id: metadata.provider_id,
                    kind,
                    title: fields.title,
                    artwork: fields.artwork,
                    year: null,
                  },
                  true
                )
              }
            >
              Refresh metadata
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>
          Title
          <input
            required
            maxLength={300}
            value={fields.title}
            onChange={(e) => patch('title', e.target.value)}
          />
          {resetButton('title')}
        </label>
        <div className="formGrid">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {statusesFor(kind).map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Metacritic score
            <input
              type="number"
              min={0}
              max={100}
              value={fields.metascore ?? ''}
              onChange={(e) =>
                patch('metascore', e.target.value === '' ? null : Number(e.target.value))
              }
            />
            {resetButton('metascore')}
          </label>
        </div>
        <div className="formGrid">
          <label>
            Release precision
            <select
              value={fields.release_precision}
              onChange={(e) => {
                const precision = e.target.value as Precision;
                patch('release_precision', precision);
                if (precision === 'unknown') patch('release_date', null);
              }}
            >
              {(['unknown', 'year', 'month', 'day'] as const).map((p) => (
                <option key={p} value={p}>
                  {p === 'day' ? 'Exact date' : label(p)}
                </option>
              ))}
            </select>
            {resetButton('release_precision')}
          </label>
          <label>
            Release {fields.release_precision === 'day' ? 'date' : 'window'}
            <input
              disabled={fields.release_precision === 'unknown'}
              type={
                fields.release_precision === 'day'
                  ? 'date'
                  : fields.release_precision === 'month'
                    ? 'month'
                    : 'number'
              }
              min={fields.release_precision === 'year' ? 1900 : undefined}
              max={fields.release_precision === 'year' ? 2200 : undefined}
              value={
                fields.release_date
                  ? fields.release_precision === 'year'
                    ? fields.release_date.slice(0, 4)
                    : fields.release_precision === 'month'
                      ? fields.release_date.slice(0, 7)
                      : fields.release_date
                  : ''
              }
              onChange={(e) =>
                patch(
                  'release_date',
                  e.target.value
                    ? fields.release_precision === 'year'
                      ? `${e.target.value.padStart(4, '0')}-01-01`
                      : fields.release_precision === 'month'
                        ? `${e.target.value}-01`
                        : e.target.value
                    : null
                )
              }
            />
            {resetButton('release_date')}
          </label>
        </div>
        <p className="hint">
          {releaseLabel(fields)} · Year/month windows don’t trigger reminders or automatic moves.
        </p>
        <fieldset>
          <legend>{kind === 'game' ? 'Your platforms' : 'Your streaming services'}</legend>
          <div className="choiceChips">
            {[
              ...new Set(
                kind === 'game'
                  ? [...PLATFORMS, ...(metadata?.fields.platforms ?? []), ...platforms]
                  : [...SERVICES, ...(metadata?.fields.services ?? []), ...services]
              ),
            ].map((v) => (
              <label key={v}>
                <input
                  type="checkbox"
                  checked={(kind === 'game' ? platforms : services).includes(v)}
                  onChange={() =>
                    kind === 'game'
                      ? choose(platforms, setPlatforms, v)
                      : choose(services, setServices, v)
                  }
                />
                <span>{v}</span>
              </label>
            ))}
          </div>
          {kind !== 'game' && (
            <p className="hint">
              No selections means None. Availability suggestions are for {profile.region}; choose
              the services you intend to use.
            </p>
          )}
        </fieldset>
        {kind === 'game' && (
          <div className="formGrid">
            <label>
              Price (optional)
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              Currency
              <input
                maxLength={3}
                pattern="[A-Za-z]{3}"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </label>
          </div>
        )}
        <label>
          Cover / poster URL
          <input
            type="url"
            placeholder="https://…"
            value={fields.artwork ?? ''}
            onChange={(e) => patch('artwork', e.target.value || null)}
          />
          {resetButton('artwork')}
        </label>
        <label>
          {kind === 'game' ? 'Publisher' : 'Studio / network'}
          <input
            value={fields.publisher ?? ''}
            onChange={(e) => patch('publisher', e.target.value || null)}
          />
          {resetButton('publisher')}
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={fields.description ?? ''}
            onChange={(e) => patch('description', e.target.value || null)}
          />
          {resetButton('description')}
        </label>
        <label>
          My notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why it caught your eye, where you left off…"
          />
        </label>
        <fieldset>
          <legend>Release & reminders</legend>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoMove}
              onChange={(e) => setAutoMove(e.target.checked)}
            />
            Move {kind === 'game' ? 'Scheduled → Backlog' : 'Upcoming → Watchlist'} on release day
          </label>
          <label>
            Remind me this many days before release
            <input
              value={reminders}
              onChange={(e) => setReminders(e.target.value)}
              placeholder="0, 7"
            />
          </label>
          <p className="hint">
            Comma-separated days, 0 for release day. In-app reminders appear at 9am in{' '}
            {profile.timezone}.
          </p>
        </fieldset>
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
        <div className="formActions">
          <button className="primary" type="submit" disabled={pending}>
            {pending ? 'Working…' : item ? 'Save changes' : 'Add title'}
          </button>
          {item && (
            <button
              className="danger"
              type="button"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              Delete title
            </button>
          )}
        </div>
        {confirmDelete && (
          <div className="deleteConfirm" role="alert">
            <p>Delete this title and its reminders? This cannot be undone.</p>
            <button
              type="button"
              className="danger"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await deleteItem(item!.id);
                  if (result.error) throw new Error(result.error);
                  finish();
                })
              }
            >
              Yes, delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
