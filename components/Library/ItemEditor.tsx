'use client';

import { Film, Tv } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { deleteItem, saveBanner, saveItem } from '@/app/library-actions';
import {
  EMPTY_FIELDS,
  effectiveFields,
  label,
  PLATFORMS,
  releaseLabel,
  SERVICES,
  serviceLabel,
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
import Countdown from './Countdown';
import CoverUpload from './CoverUpload';
import RestoreFetchedButton from './RestoreFetchedButton';

type Props = {
  kind: ItemKind;
  profile: ProfileRow;
  item?: LibraryItem;
  reminderDays?: number[];
  onDone?: () => void;
  initialTitle?: string;
  initialStatus?: Status;
  initialServices?: string[];
  eagerArtwork?: ReadonlySet<string>;
};

const ItemEditor = ({
  kind: initialKind,
  profile,
  item,
  reminderDays,
  onDone,
  initialTitle = '',
  initialStatus,
  initialServices,
  eagerArtwork,
}: Props) => {
  const router = useRouter();
  const [pending, start] = useTransition();

  const libraryKind = initialKind === 'game' ? 'game' : 'screen';
  const savedBannerId = profile.banner_items?.[libraryKind] ?? null;
  const [bannerId, setBannerId] = useState(savedBannerId);

  useEffect(() => {
    setBannerId(savedBannerId);
  }, [savedBannerId]);

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
  const [coverPending, setCoverPending] = useState(false);

  const fields = effectiveFields(metadata?.fields ?? EMPTY_FIELDS, overrides);

  const patch = <K extends keyof MetadataFields>(key: K, value: MetadataFields[K]) =>
    setOverrides((prev) => ({ ...prev, [key]: value }));

  const restoreFetched = (key: keyof MetadataFields) => {
    setOverrides((prev) => {
      const next = { ...prev };

      delete next[key];

      return next;
    });
  };

  const finish = () => {
    router.refresh();

    if (onDone) onDone();
    else router.push(kind === 'game' ? '/games' : '/screen');
  };

  const run = (work: () => Promise<void>) => {
    setError('');
    setMessage('');
    start(async () => {
      try {
        await work();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    });
  };

  const load = (result: SearchResult, refresh = false) => {
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
  };

  const submit = () => {
    if (coverPending) return;

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
  };

  const choose = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className={`editor ${item ? 'itemDetails' : 'itemCreate'}`}>
      {item && item.status === (kind === 'game' ? 'playing' : 'watching') && (
        <label className="itemBannerSetting">
          <input
            type="checkbox"
            checked={bannerId === item.id}
            disabled={pending || coverPending}
            onChange={(event) => {
              const selectedId = event.target.checked ? item.id : null;

              run(async () => {
                const result = await saveBanner(libraryKind, selectedId);

                if (result.error) throw new Error(result.error);

                setBannerId(selectedId);
                router.refresh();
              });
            }}
          />
          <span>Show in banner</span>
        </label>
      )}
      {item && (
        <header className="itemOverview">
          <div
            className={`itemDetailArtwork ${kind === 'game' ? 'detailGameArt' : 'detailScreenArt'}`}
          >
            <Artwork
              url={fields.artwork}
              title={fields.title}
              kind={kind}
              eager
              highPriority
              sizes="(max-width: 650px) calc(100vw - 32px), calc(100vw - 280px)"
            />
          </div>
          <div className="itemOverviewBody">
            <span className="eyebrow">
              {kind === 'game' ? 'Game' : kind === 'show' ? 'TV series' : 'Movie'}
            </span>
            <h1>{fields.title || 'Untitled'}</h1>
            <div className="itemOverviewMeta">
              <span className={`detailStatus status-${status}`}>{label(status)}</span>
              <span>{releaseLabel(fields)}</span>
              <Countdown fields={fields} timezone={profile.timezone} />
              {fields.metascore !== null && <span>Metacritic {fields.metascore}</span>}
            </div>
            {fields.publisher && <p className="hint">{fields.publisher}</p>}
          </div>
        </header>
      )}
      {!item && (
        <div className="editorHeading">
          <div>
            <span className="eyebrow">A new adventure</span>
            <h2>Add to your library</h2>
          </div>
          {onDone && (
            <button type="button" aria-label="Close editor" onClick={onDone}>
              ✕
            </button>
          )}
        </div>
      )}
      {!item && initialKind !== 'game' && (
        <fieldset className="screenTypePicker editorTypePicker" aria-label="Title type">
          <legend>What are you adding?</legend>
          {(
            [
              { value: 'movie', title: 'Movie', Icon: Film },
              { value: 'show', title: 'TV series', Icon: Tv },
            ] as const
          ).map(({ value, title, Icon }) => (
            <button
              type="button"
              key={value}
              aria-pressed={kind === value}
              disabled={pending}
              onClick={() => {
                if (kind === value) return;

                setKind(value);
                setMetadata(null);
                setResults([]);
                setError('');
                setMessage('');
              }}
            >
              <Icon size={18} aria-hidden="true" />
              {title}
            </button>
          ))}
        </fieldset>
      )}
      <details className="itemProviderTools" open={item ? undefined : true}>
        <summary>{item ? 'Search & refresh metadata' : 'Find your title'}</summary>
        <div className="providerToolsBody">
          <div className="searchBox">
            <label>
              Find a {kind === 'game' ? 'game' : kind === 'show' ? 'TV series' : 'movie'}
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

                      if (!data.results.length)
                        setMessage('No matches. Add a title manually below.');
                    })
                  }
                >
                  Search
                </button>
              </div>
            </label>
            <p className="hint">
              {item
                ? 'Search to link another match. Your manual edits are kept.'
                : 'Or enter just a title below. You can link it to a match later.'}
            </p>
          </div>
          {results.length > 0 && (
            <div className="searchResults">
              {results.map((result, index) => (
                <button
                  type="button"
                  className="searchResult"
                  key={`${result.provider}:${result.provider_id}`}
                  onClick={() => load(result)}
                  disabled={pending}
                >
                  <Artwork
                    url={result.artwork}
                    title={result.title}
                    kind={kind}
                    eager={
                      index < 4 ||
                      result.artwork === fields.artwork ||
                      Boolean(result.artwork && eagerArtwork?.has(result.artwork))
                    }
                    sizes="50px"
                  />
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
        </div>
      </details>
      <form
        className="itemDetailForm"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="itemDetailColumns">
          <div className="itemDetailMain">
            <fieldset className="editorSection">
              <legend>Your library</legend>
              <p className="sectionIntro">
                {kind === 'game'
                  ? 'Choose how and where you want to play.'
                  : kind === 'show'
                    ? 'Track the whole series and where you’ll watch.'
                    : 'Keep your next movie night organised.'}
              </p>
              <label>
                Title
                <input
                  required
                  maxLength={300}
                  value={fields.title}
                  onChange={(e) => patch('title', e.target.value)}
                />
                <RestoreFetchedButton
                  available={Boolean(metadata) && 'title' in overrides}
                  disabled={pending || coverPending}
                  onRestore={() => restoreFetched('title')}
                />
              </label>
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
              <fieldset className="detailChoices">
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
                      <span>{kind === 'game' ? v : serviceLabel(v)}</span>
                    </label>
                  ))}
                </div>
                {kind !== 'game' && (
                  <p className="hint">
                    No selections means None. Availability suggestions are for {profile.region}.
                    Choose the services you intend to use.
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
            </fieldset>
          </div>
          <fieldset className="editorSection itemDetailRelease">
            <legend>Release & reminders</legend>
            <p className="sectionIntro">Plan ahead for the next release.</p>
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
                <RestoreFetchedButton
                  available={Boolean(metadata) && 'release_precision' in overrides}
                  disabled={pending || coverPending}
                  onRestore={() => restoreFetched('release_precision')}
                />
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
                <RestoreFetchedButton
                  available={Boolean(metadata) && 'release_date' in overrides}
                  disabled={pending || coverPending}
                  onRestore={() => restoreFetched('release_date')}
                />
              </label>
            </div>
            <p className="hint">
              {releaseLabel(fields)} · Year/month windows don’t trigger reminders or automatic
              moves.
            </p>
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
        </div>
        <div className="itemDetailPersonal">
          <fieldset className="editorSection itemDetailNotes">
            <legend>My notes</legend>
            <p className="sectionIntro">
              A space for your thoughts, progress, and recommendations.
            </p>
            <label>
              <span className="srOnly">My notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why it caught your eye, where you left off…"
              />
            </label>
          </fieldset>
          <fieldset className="editorSection itemCoverSection">
            <legend>Cover image</legend>
            <p className="sectionIntro">
              Use your own artwork or keep the image from your linked title.
            </p>
            {item && (
              <CoverUpload
                itemId={item.id}
                disabled={pending}
                onBusy={setCoverPending}
                onUploaded={(url) => patch('artwork', url)}
              />
            )}
            <label>
              Cover / poster URL
              <input
                type="url"
                disabled={coverPending}
                placeholder="https://…"
                value={fields.artwork?.startsWith('/api/covers/') ? '' : (fields.artwork ?? '')}
                onChange={(e) => patch('artwork', e.target.value || null)}
              />
            </label>
            {fields.artwork?.startsWith('/api/covers/') && (
              <p className="hint">
                Your uploaded image is selected. Paste a URL above to replace it.
              </p>
            )}
            <div className="coverActions">
              <RestoreFetchedButton
                available={Boolean(metadata) && 'artwork' in overrides}
                disabled={pending || coverPending}
                onRestore={() => restoreFetched('artwork')}
              />
              {fields.artwork && (
                <button
                  className="textButton"
                  type="button"
                  disabled={pending || coverPending}
                  onClick={() => patch('artwork', null)}
                >
                  Remove image
                </button>
              )}
            </div>
          </fieldset>
        </div>
        <details className="itemMetadataFields" open={item ? undefined : true}>
          <summary>Title information</summary>
          <div className="itemMetadataBody">
            <p className="sectionIntro">
              Edit the description and fetched details. Your changes are preserved when refreshing
              metadata.
            </p>
            <div className="formGrid">
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
                <RestoreFetchedButton
                  available={Boolean(metadata) && 'metascore' in overrides}
                  disabled={pending || coverPending}
                  onRestore={() => restoreFetched('metascore')}
                />
              </label>
              <label>
                {kind === 'game' ? 'Publisher' : 'Studio / network'}
                <input
                  value={fields.publisher ?? ''}
                  onChange={(e) => patch('publisher', e.target.value || null)}
                />
                <RestoreFetchedButton
                  available={Boolean(metadata) && 'publisher' in overrides}
                  disabled={pending || coverPending}
                  onRestore={() => restoreFetched('publisher')}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                rows={4}
                value={fields.description ?? ''}
                onChange={(e) => patch('description', e.target.value || null)}
              />
              <RestoreFetchedButton
                available={Boolean(metadata) && 'description' in overrides}
                disabled={pending || coverPending}
                onRestore={() => restoreFetched('description')}
              />
            </label>
          </div>
        </details>
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
        <div className="formActions itemDetailActions">
          <button className="primary" type="submit" disabled={pending || coverPending}>
            {pending ? 'Working…' : item ? 'Save changes' : 'Add title'}
          </button>
          {item && (
            <button
              className="danger"
              type="button"
              disabled={pending || coverPending}
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
};

export default ItemEditor;
