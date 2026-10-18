'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  ArrowDownUp,
  Gamepad2,
  GripVertical,
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
import { moveItem } from '@/app/library-actions';
import { shelfKeyboardCoordinates } from '@/lib/drag';
import { label, PLATFORMS, releaseLabel, serviceLabel, SERVICES, statusesFor } from '@/lib/library';
import type { LibraryItem, ProfileRow, Status } from '@/types/library';
import Artwork from './Artwork';
import Countdown from './Countdown';
import ItemEditor from './ItemEditor';

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

function Card({
  item,
  profile,
  move,
  pending,
  group = 'grid',
}: {
  item: LibraryItem;
  profile: ProfileRow;
  move: (id: string, status: Status) => void;
  pending: boolean;
  group?: string;
}) {
  const drag = useDraggable({ id: `${group}:${item.id}`, data: { itemId: item.id } });
  return (
    <article
      ref={drag.setNodeRef}
      className={`itemCard status-${item.status} ${drag.isDragging ? 'dragging' : ''}`}
      style={
        drag.transform
          ? { transform: `translate3d(${drag.transform.x}px,${drag.transform.y}px,0)`, zIndex: 20 }
          : undefined
      }
    >
      <Link href={`/items/${item.id}`} className="cardArtLink">
        <Artwork url={item.fields.artwork} title={item.fields.title} kind={item.kind} />
        {item.fields.metascore !== null && (
          <span className="metascore" role="img" aria-label={`Metacritic ${item.fields.metascore}`}>
            {item.fields.metascore}
          </span>
        )}
      </Link>
      <div className="cardBody">
        <div className="cardTop">
          <Link href={`/items/${item.id}`}>
            <h3>{item.fields.title}</h3>
          </Link>
          <button
            type="button"
            className="dragHandle"
            {...drag.attributes}
            {...drag.listeners}
            aria-label={`Drag ${item.fields.title} to a status shelf`}
          >
            <GripVertical size={18} />
          </button>
        </div>
        <p className="cardMeta">
          {item.kind === 'game'
            ? item.platforms.join(' · ') || 'Platform not chosen'
            : `${item.kind === 'show' ? 'TV show' : 'Movie'} · ${[...new Set(item.services.map(serviceLabel))].join(' · ') || 'None'}`}
        </p>
        {item.fields.release_date && <p className="cardDate">{releaseLabel(item.fields)}</p>}
        <Countdown fields={item.fields} timezone={profile.timezone} />
        <div className="cardFoot">
          <select
            aria-label={`Status of ${item.fields.title}`}
            value={item.status}
            disabled={pending}
            onChange={(e) => move(item.id, e.target.value as Status)}
          >
            {statusesFor(item.kind).map((s) => (
              <option value={s} key={s}>
                {label(s)}
              </option>
            ))}
          </select>
          {item.kind === 'game' && (
            <span className="price">
              {item.price === null
                ? 'Price —'
                : new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: item.currency,
                  }).format(item.price)}
            </span>
          )}
        </div>
      </div>
    </article>
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
  const [sort, setSort] = useState('added');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [moved, setMoved] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogTitle = useId();
  useEffect(() => {
    if (adding) dialog.current?.showModal();
    else dialog.current?.close();
  }, [adding]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: shelfKeyboardCoordinates })
  );
  const relevant = items.filter((i) => (kind === 'game' ? i.kind === 'game' : i.kind !== 'game'));
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
  const cards = (list: LibraryItem[], group?: string) =>
    list.map((item) => (
      <Card
        key={item.id}
        item={item}
        profile={profile}
        move={move}
        pending={pending}
        group={group}
      />
    ));
  return (
    <div className="libraryPage">
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
            kind={kind === 'game' ? 'game' : 'movie'}
            profile={profile}
            onDone={() => setAdding(false)}
          />
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
