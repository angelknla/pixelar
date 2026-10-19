'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  ArrowDownUp,
  Gamepad2,
  ListFilter,
  MonitorPlay,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { deleteItem, moveItem } from '@/app/library-actions';
import { shelfKeyboardCoordinates } from '@/lib/drag';
import { label, PLATFORMS, SERVICES, serviceLabel, statusesFor } from '@/lib/library';
import type { LibraryItem, ProfileRow, Status } from '@/types/library';
import Artwork from './Artwork';
import GameTile from './GameTile';
import ItemEditor from './ItemEditor';
import ScreenTile from './ScreenTile';

function FilterSelect({
  name,
  value,
  display,
  compactDisplay = display,
  icon,
  onChange,
  children,
}: {
  name: string;
  value: string;
  display: string;
  compactDisplay?: string;
  icon: React.ReactNode;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="filterSelect">
      <span className="filterIcon" aria-hidden="true">
        {icon}
      </span>
      <span className="filterValue" aria-hidden="true">
        {display}
      </span>
      <span className="filterCompactValue" aria-hidden="true">
        {compactDisplay}
      </span>
      <select
        aria-label={name}
        title={`${name}: ${display}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function Shelf({
  name,
  status,
  children,
  count,
}: {
  name: string;
  status?: Status;
  children: React.ReactNode;
  count: number;
}) {
  const drop = useDroppable({ id: status ?? name, disabled: !status });
  return (
    <section
      ref={drop.setNodeRef}
      className={`shelf ${status ? `status-${status}` : ''} ${drop.isOver ? 'dropOver' : ''}`}
    >
      <div className="shelfHeading">
        <h2>
          <span className="shelfDot" />
          {name} <span className="countBadge">{count}</span>
        </h2>
        {status && <span className="hint">Drop a title here</span>}
      </div>
      <div className="cardGrid">{children}</div>
      {count === 0 && <p className="emptyShelf">Room for your next favourite.</p>}
    </section>
  );
}
export default function Library({
  items,
  profile,
  kind,
}: {
  items: LibraryItem[];
  profile: ProfileRow;
  kind: 'game' | 'screen';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState(kind === 'game' ? 'status' : 'service');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [platform, setPlatform] = useState('');
  const [service, setService] = useState('');
  const [screenType, setScreenType] = useState<'' | 'movie' | 'show'>('');
  const [sort, setSort] = useState('added');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [moved, setMoved] = useState('');
  const [removing, setRemoving] = useState<LibraryItem | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [removePending, startRemove] = useTransition();
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const removeCancel = useRef<HTMLButtonElement>(null);
  const removeHeading = useId();
  const removeDescription = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogTitle = useId();
  useEffect(() => {
    if (adding) dialog.current?.showModal();
    else dialog.current?.close();
  }, [adding]);
  useEffect(() => {
    if (!removing) return;
    const element = removeDialog.current;
    if (!element) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    removeCancel.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, [removing]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: shelfKeyboardCoordinates })
  );
  const relevant = items.filter(
    (i) => !removedIds.includes(i.id) && (kind === 'game' ? i.kind === 'game' : i.kind !== 'game')
  );
  const serviceOptions = [
    ...new Set(
      [...SERVICES, ...profile.services, ...relevant.flatMap((i) => i.services)].map(serviceLabel)
    ),
  ];
  const featured =
    relevant.find((item) => item.status === (kind === 'game' ? 'playing' : 'watching')) ??
    relevant.find((item) => item.fields.artwork) ??
    relevant[0];
  const filtered = relevant
    .filter(
      (i) =>
        (!query || i.fields.title.toLowerCase().includes(query.toLowerCase())) &&
        (!status || i.status === status) &&
        (!screenType || i.kind === screenType) &&
        (!platform ||
          i.platforms.includes(platform) ||
          (!i.platforms.length && i.metadata?.fields.platforms.includes(platform))) &&
        (!service ||
          (service === '__none__'
            ? i.services.length === 0
            : i.services.some((s) => serviceLabel(s) === service)))
    )
    .sort((a, b) =>
      sort === 'score'
        ? (b.fields.metascore ?? -1) - (a.fields.metascore ?? -1)
        : sort === 'price'
          ? (a.price ?? Infinity) - (b.price ?? Infinity)
          : sort === 'release'
            ? (a.fields.release_date ?? '9999').localeCompare(b.fields.release_date ?? '9999')
            : b.created_at.localeCompare(a.created_at)
    );
  const move = (id: string, next: Status) => {
    setError('');
    start(async () => {
      const result = await moveItem(id, next);
      if (result.error) setError(result.error);
      else {
        setMoved(`Moved to ${label(next)} ✦`);
        router.refresh();
      }
    });
  };
  const statuses = statusesFor(kind === 'game' ? 'game' : 'movie');
  const groups =
    view === 'status'
      ? statuses.map((s) => ({
          name: label(s),
          status: s,
          items: filtered.filter((i) => i.status === s),
        }))
      : view === 'service'
        ? [
            ...new Set(
              [...profile.services, ...relevant.flatMap((i) => i.services)].map(serviceLabel)
            ),
            'None',
          ]
            .filter((name) => !service || name === (service === '__none__' ? 'None' : service))
            .map((name) => ({
              name,
              status: undefined,
              items: filtered.filter((i) =>
                name === 'None'
                  ? i.services.length === 0
                  : i.services.some((s) => serviceLabel(s) === name)
              ),
            }))
        : [];
  const Tile = kind === 'game' ? GameTile : ScreenTile;
  const cards = (list: LibraryItem[], group?: string) =>
    list.map((item) => (
      <Tile
        key={item.id}
        item={item}
        profile={profile}
        move={move}
        pending={pending}
        onRemove={(item) => {
          setRemoveError('');
          setRemoving(item);
        }}
        group={group}
      />
    ));
  return (
    <div className={`libraryPage ${kind === 'game' ? 'gameLibrary' : 'screenLibrary'}`}>
      <section className={`libraryHero ${featured ? '' : 'libraryHeroEmpty'}`}>
        <header className="pageHeading">
          <div>
            <span className="eyebrow">Your collection</span>
            <h1>{kind === 'game' ? 'Game library' : 'Movies & TV'}</h1>
            <p>
              {kind === 'game'
                ? 'Pick up where you left off. Find your next adventure.'
                : 'Your next movie night. Your next must-watch series.'}
            </p>
          </div>
          <button type="button" className="primary" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden="true" />
            Add {kind === 'game' ? 'game' : 'title'}
          </button>
        </header>
        {featured && (
          <Link href={`/items/${featured.id}`} className="heroFeature">
            <Artwork
              url={featured.fields.artwork}
              title={featured.fields.title}
              kind={featured.kind}
              eager
            />
            <div className="heroFeatureCaption">
              <span className="heroStatus">{label(featured.status)}</span>
              <strong>{featured.fields.title}</strong>
              <span className="heroFeatureAction">View details ↗</span>
            </div>
          </Link>
        )}
      </section>
      <div className="libraryStats">
        <span>
          <strong>{relevant.length}</strong> in your library
        </span>
        <span>
          <strong>
            {relevant.filter((i) => i.status === 'playing' || i.status === 'watching').length}
          </strong>{' '}
          {kind === 'game' ? 'playing now' : 'watching now'}
        </span>
        <Link href="/import">Import your notes ↗</Link>
      </div>
      <div className="toolbar">
        <label className="searchInput">
          <Search size={18} />
          <input
            aria-label="Search your library"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in your library…"
          />
        </label>
        <fieldset className="viewSwitcher" aria-label="Library view">
          {(kind === 'game' ? ['status', 'grid'] : ['service', 'status', 'grid']).map((v) => (
            <button type="button" aria-pressed={view === v} key={v} onClick={() => setView(v)}>
              {v === 'status' ? 'Shelves' : v === 'service' ? 'Services' : 'Grid'}
            </button>
          ))}
        </fieldset>
      </div>
      {kind === 'screen' && (
        <fieldset className="screenTypePicker" aria-label="Filter by title type">
          {(
            [
              { value: '', title: 'All titles' },
              { value: 'movie', title: 'Movies' },
              { value: 'show', title: 'TV series' },
            ] as const
          ).map(({ value, title }) => (
            <button
              key={value}
              type="button"
              aria-pressed={screenType === value}
              onClick={() => setScreenType(value)}
            >
              {title}
            </button>
          ))}
        </fieldset>
      )}
      <div className="filters">
        <SlidersHorizontal className="filterBarIcon" size={16} aria-hidden="true" />
        <FilterSelect
          name="Filter by status"
          value={status}
          display={status ? label(status) : 'All statuses'}
          compactDisplay={status ? label(status) : 'Status'}
          icon={<ListFilter size={16} />}
          onChange={setStatus}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </FilterSelect>
        {kind === 'game' ? (
          <FilterSelect
            name="Filter by platform"
            value={platform}
            display={platform || 'All platforms'}
            compactDisplay={platform || 'Platform'}
            icon={<Gamepad2 size={16} />}
            onChange={setPlatform}
          >
            <option value="">All platforms</option>
            {[
              ...new Set([
                ...PLATFORMS,
                ...profile.platforms,
                ...relevant.flatMap((i) => [
                  ...i.platforms,
                  ...(i.metadata?.fields.platforms ?? []),
                ]),
              ]),
            ].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </FilterSelect>
        ) : (
          <FilterSelect
            name="Filter by streaming service"
            value={service}
            display={service === '__none__' ? 'No service selected' : service || 'All services'}
            compactDisplay={service === '__none__' ? 'None' : service || 'Service'}
            icon={<MonitorPlay size={16} />}
            onChange={setService}
          >
            <option value="">All services</option>
            {serviceOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
            <option value="__none__">No service selected</option>
          </FilterSelect>
        )}
        <FilterSelect
          name="Sort titles"
          value={sort}
          display={
            sort === 'added'
              ? 'Recently added'
              : sort === 'release'
                ? 'Release date'
                : sort === 'score'
                  ? 'Metacritic score'
                  : 'Price: low to high'
          }
          compactDisplay={
            sort === 'added'
              ? 'Added'
              : sort === 'release'
                ? 'Release'
                : sort === 'score'
                  ? 'Score'
                  : 'Price'
          }
          icon={<ArrowDownUp size={16} />}
          onChange={setSort}
        >
          <option value="added">Recently added</option>
          <option value="release">Release date</option>
          <option value="score">Metacritic score</option>
          {kind === 'game' && <option value="price">Price: low to high</option>}
        </FilterSelect>
        <span className="filterCount">
          {filtered.length}
          <span> titles</span>
        </span>
      </div>
      {error && (
        <p className="errorMessage" role="alert">
          {error}
        </p>
      )}
      {moved && (
        <p className="moveToast" role="status" key={moved}>
          {moved}
        </p>
      )}
      {relevant.length === 0 ? (
        <div className="emptyState">
          <Image src="/icon.svg?v=2" alt="" width={48} height={48} unoptimized />
          <h2>Your collection starts here.</h2>
          <p>Add something you’re excited about, or bring over your notes.</p>
          <button type="button" className="primary" onClick={() => setAdding(true)}>
            Add your first title
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="emptyState">
          <h2>No titles match.</h2>
          <p>Try another search or clear your filters.</p>
        </div>
      ) : (
        <DndContext
          id={dialogTitle}
          sensors={sensors}
          onDragEnd={({ active, over }) => {
            if (over && statuses.includes(String(over.id) as Status))
              move(String(active.data.current?.itemId), String(over.id) as Status);
          }}
        >
          {view === 'grid' ? (
            <div className="cardGrid flatGrid">{cards(filtered)}</div>
          ) : (
            groups.map((group) => (
              <Shelf
                key={group.name}
                name={group.name}
                status={group.status}
                count={group.items.length}
              >
                {cards(group.items, group.name)}
              </Shelf>
            ))
          )}
          {view !== 'status' && (
            <div className="dropTargets">
              <p className="hint">Drag to change status</p>
              {statuses.map((s) => (
                <DropTarget key={s} status={s} />
              ))}
            </div>
          )}
        </DndContext>
      )}
      <p className="attribution">
        <Image src="/tmdb.svg" alt="TMDB" width={70} height={28} /> Game metadata:{' '}
        <a href="https://rawg.io" target="_blank" rel="noreferrer">
          RAWG
        </a>
        . Screen metadata and images:{' '}
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
          TMDB
        </a>
        . Metascores: OMDb. This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <dialog
        ref={dialog}
        className="editorDialog"
        aria-labelledby={dialogTitle}
        onCancel={() => setAdding(false)}
        onClose={() => setAdding(false)}
      >
        <span id={dialogTitle} className="srOnly">
          Add a title
        </span>
        {adding && (
          <ItemEditor
            kind={kind === 'game' ? 'game' : screenType || 'movie'}
            profile={profile}
            onDone={() => setAdding(false)}
          />
        )}
      </dialog>
      <dialog
        ref={removeDialog}
        className="removeDialog"
        aria-labelledby={removeHeading}
        aria-describedby={removeDescription}
        onCancel={(event) => {
          event.preventDefault();
          if (!removePending) setRemoving(null);
        }}
      >
        {removing && (
          <>
            <h2 id={removeHeading}>Remove title?</h2>
            <p id={removeDescription}>
              Remove <strong>{removing.fields.title}</strong> from your library? Its notes and
              reminders will also be deleted. This cannot be undone.
            </p>
            {removeError && (
              <p className="errorMessage" role="alert">
                {removeError}
              </p>
            )}
            <div className="removeDialogActions">
              <button
                ref={removeCancel}
                type="button"
                disabled={removePending}
                onClick={() => setRemoving(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={removePending}
                onClick={() => {
                  setRemoveError('');
                  startRemove(async () => {
                    try {
                      const result = await deleteItem(removing.id);
                      if (result.error) {
                        setRemoveError(result.error);
                        return;
                      }
                      setRemovedIds((ids) => [...ids, removing.id]);
                      setRemoving(null);
                      router.refresh();
                    } catch {
                      setRemoveError('Could not remove title. Please try again.');
                    }
                  });
                }}
              >
                {removePending ? 'Removing…' : 'Remove title'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
function DropTarget({ status }: { status: Status }) {
  const drop = useDroppable({ id: status });
  return (
    <div
      ref={drop.setNodeRef}
      className={`dropTarget status-${status} ${drop.isOver ? 'dropOver' : ''}`}
    >
      {label(status)}
    </div>
  );
}
