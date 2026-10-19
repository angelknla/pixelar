'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Layers3,
  LayoutGrid,
  List,
  MonitorPlay,
  Plus,
  RefreshCw,
  Rows3,
  Search,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { deleteItem, moveItem, saveShelfLayout } from '@/app/library-actions';
import { createShelfKeyboardCoordinates } from '@/lib/drag';
import { label, PLATFORMS, SERVICES, serviceLabel, statusesFor } from '@/lib/library';
import { orderedShelves, reorderShelves, shelfLayout } from '@/lib/shelves';
import type {
  LibraryItem,
  ProfileRow,
  ShelfLayout,
  ShelfLayouts,
  ShelfView,
  Status,
} from '@/types/library';
import Artwork from './Artwork';
import GameTile from './GameTile';
import ItemEditor from './ItemEditor';
import ScreenTile from './ScreenTile';

function compareReleaseDates(a: LibraryItem, b: LibraryItem) {
  const date = (item: LibraryItem) =>
    item.fields.release_precision === 'unknown' ? '9999' : (item.fields.release_date ?? '9999');
  return date(a).localeCompare(date(b));
}

function FilterSelect({
  name,
  value,
  display,
  compactDisplay = display,
  onChange,
  children,
}: {
  name: string;
  value: string;
  display: string;
  compactDisplay?: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="filterSelect">
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
  collapsed,
  onToggle,
  onReorder,
  first,
  last,
  display,
}: {
  name: string;
  status?: Status;
  children: React.ReactNode;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onReorder: (direction: number) => void;
  first: boolean;
  last: boolean;
  display: 'grid' | 'list';
}) {
  const contentId = useId();
  const drop = useDroppable({ id: status ?? name, disabled: !status, data: { type: 'item' } });
  const target = useDroppable({ id: `shelf:${name}`, data: { type: 'shelf', name } });
  const drag = useDraggable({ id: `shelf:${name}`, data: { type: 'shelf', name } });
  return (
    <section
      ref={drop.setNodeRef}
      className={`shelf ${status ? `status-${status}` : ''} ${drop.isOver ? 'dropOver' : ''} ${collapsed ? 'shelfCollapsed' : ''} ${target.isOver ? 'shelfReorderTarget' : ''}`}
    >
      <div className="shelfHeading" ref={target.setNodeRef}>
        <h2>
          <button
            type="button"
            className="shelfToggle"
            aria-expanded={!collapsed}
            aria-controls={contentId}
            onClick={onToggle}
          >
            <span className="shelfDot" />
            <span className="shelfName">{name}</span> <span className="countBadge">{count}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </h2>
        <div className="shelfHeadingActions">
          {status && <span className="hint">Drop a title here</span>}
          <button
            type="button"
            className="shelfMove"
            aria-label={`Move ${name} shelf up`}
            disabled={first}
            onClick={() => onReorder(-1)}
          >
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="shelfMove"
            aria-label={`Move ${name} shelf down`}
            disabled={last}
            onClick={() => onReorder(1)}
          >
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="shelfDrag"
            ref={drag.setNodeRef}
            {...drag.listeners}
            {...drag.attributes}
            aria-label={`Reorder ${name} shelf`}
            title="Drag to reorder shelf"
          >
            <GripVertical size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div id={contentId} hidden={collapsed}>
        <div className={`cardGrid ${display === 'list' ? 'listGrid' : ''}`}>
          {collapsed ? null : children}
        </div>
        {count === 0 && <p className="emptyShelf">Room for your next favourite.</p>}
      </div>
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
  const [display, setDisplay] = useState<'grid' | 'list'>('grid');
  useLayoutEffect(() => {
    if (window.innerWidth <= 650) setDisplay('list');
  }, []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [platform, setPlatform] = useState('');
  const [service, setService] = useState('');
  const [screenType, setScreenType] = useState<'' | 'movie' | 'show'>('');
  const [sort, setSort] = useState('added');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [moved, setMoved] = useState('');
  const [metadataSync, setMetadataSync] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncFailed, setSyncFailed] = useState<string[]>([]);
  const metadataSyncLock = useRef(false);
  const [removing, setRemoving] = useState<LibraryItem | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [removePending, startRemove] = useTransition();
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [layouts, setLayouts] = useState<ShelfLayouts>(profile.shelf_layouts ?? {});
  const [shelfError, setShelfError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [draggingShelf, setDraggingShelf] = useState<string | null>(null);
  const keyboardTarget = useRef<string | null>(null);
  const keyboardCoordinates = useRef(
    createShelfKeyboardCoordinates((id) => {
      keyboardTarget.current = id;
    })
  ).current;
  const queuedLayouts = useRef(new Map<ShelfView, ShelfLayout>());
  const savingLayouts = useRef(false);
  const failedLayouts = useRef(new Map<ShelfView, ShelfLayout>());
  const shelfView: ShelfView =
    kind === 'game' ? 'games_status' : view === 'service' ? 'tv_service' : 'tv_status';
  const currentLayout = shelfLayout(layouts, shelfView);
  async function syncLayouts() {
    if (savingLayouts.current) return;
    savingLayouts.current = true;
    setSyncing(true);
    setShelfError('');
    try {
      while (queuedLayouts.current.size) {
        const [key, layout] = queuedLayouts.current.entries().next().value!;
        queuedLayouts.current.delete(key);
        const result = await saveShelfLayout(key, layout);
        if (result.error) {
          failedLayouts.current.set(key, layout);
          setShelfError(result.error);
        } else failedLayouts.current.delete(key);
      }
    } catch {
      setShelfError('Could not sync shelves. Please try again.');
    } finally {
      savingLayouts.current = false;
      setSyncing(false);
      if (failedLayouts.current.size === 0) setShelfError('');
    }
  }
  function updateLayout(next: ShelfLayout) {
    setLayouts((previous) => ({ ...previous, [shelfView]: next }));
    queuedLayouts.current.set(shelfView, next);
    failedLayouts.current.set(shelfView, next);
    void syncLayouts();
  }
  const [visibleArtwork, setVisibleArtwork] = useState<Set<string>>(() => new Set());
  const library = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = library.current;
    if (!root) return;
    const promoted = new Set<string>();
    const promote = (visible: HTMLImageElement[]) => {
      const urls = visible
        .flatMap((image) => image.getAttribute('src') ?? [])
        .filter((url) => !promoted.has(url));
      if (!urls.length) return;
      urls.forEach((url) => {
        promoted.add(url);
      });
      setVisibleArtwork(new Set(promoted));
    };
    const checkViewport = () =>
      promote(
        Array.from(root.querySelectorAll<HTMLImageElement>('.artwork img')).filter((image) => {
          const rect = image.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
          );
        })
      );
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            promote(
              entries
                .filter((entry) => entry.isIntersecting)
                .map((entry) => entry.target as HTMLImageElement)
            );
          });
    const observeImages = () => {
      observer?.disconnect();
      root.querySelectorAll('.artwork img').forEach((image) => {
        observer?.observe(image);
      });
      checkViewport();
    };
    observeImages();
    // Filters, shelves and search results can replace images without remounting the library.
    const mutations = new MutationObserver(observeImages);
    mutations.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
    window.addEventListener('resize', checkViewport);
    return () => {
      mutations.disconnect();
      observer?.disconnect();
      window.removeEventListener('resize', checkViewport);
    };
  }, []);
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
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      scrollBehavior: 'auto',
    })
  );
  const relevant = items.filter(
    (i) => !removedIds.includes(i.id) && (kind === 'game' ? i.kind === 'game' : i.kind !== 'game')
  );
  async function syncMetadata(retry = false) {
    if (metadataSyncLock.current) return;
    metadataSyncLock.current = true;
    setMetadataSync(true);
    setError('');
    setSyncFailed([]);
    // A single provider link can appear on multiple shelves or saved titles.
    const targets = [
      ...new Map(
        relevant
          .filter((item) => item.metadata_id && (!retry || syncFailed.includes(item.id)))
          .map((item) => [item.metadata_id, item.id])
      ).values(),
    ];
    const failed: string[] = [];
    let updated = 0;
    try {
      for (let offset = 0; offset < targets.length; offset += 4) {
        setSyncMessage(`Syncing ${offset} of ${targets.length} titles…`);
        const batch = targets.slice(offset, offset + 4);
        try {
          const response = await fetch('/api/metadata/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_ids: batch }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error('Could not sync titles.');
          for (const id of batch) {
            const outcome = data.outcomes?.find(
              (entry: { id: string; state: string }) => entry.id === id
            );
            if (outcome?.state === 'updated') updated++;
            else if (outcome?.state !== 'skipped') failed.push(id);
          }
        } catch {
          failed.push(...batch);
        }
      }
      const unmatched = relevant.filter((item) => !item.metadata_id).length;
      setSyncMessage(
        `${updated} ${updated === 1 ? 'title' : 'titles'} updated.${unmatched ? ` ${unmatched} unmatched ${unmatched === 1 ? 'title skipped' : 'titles skipped'}.` : ''}`
      );
      setSyncFailed(failed);
      if (failed.length)
        setError(
          `${failed.length} ${failed.length === 1 ? 'title could' : 'titles could'} not sync. Cached data is still available.`
        );
      router.refresh();
    } finally {
      metadataSyncLock.current = false;
      setMetadataSync(false);
    }
  }
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
          : sort === 'release' || (kind === 'game' && status === 'scheduled')
            ? compareReleaseDates(a, b)
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
  const unsortedGroups: { name: string; status: Status | undefined; items: LibraryItem[] }[] =
    view === 'status'
      ? statuses.map((s) => ({
          name: label(s),
          status: s,
          items:
            kind === 'game' && s === 'scheduled' && sort === 'added'
              ? filtered.filter((i) => i.status === s).sort(compareReleaseDates)
              : filtered.filter((i) => i.status === s),
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
  const groups = orderedShelves(unsortedGroups, currentLayout.order);
  function reorderShelf(from: string, to: string) {
    if (from === to) return;
    const order = [
      ...groups.map((group) => group.name),
      ...currentLayout.order.filter((name) => !groups.some((group) => group.name === name)),
    ];
    updateLayout({ ...currentLayout, order: reorderShelves(order, from, to) });
  }
  const Tile = kind === 'game' ? GameTile : ScreenTile;
  const firstGroup = groups.find(
    (group) => group.items.length && !currentLayout.collapsed.includes(group.name)
  )?.name;
  const firstTitles =
    view === 'all' ? filtered : (groups.find((group) => group.name === firstGroup)?.items ?? []);
  // Next tracks LCP by URL, so every copy of the hero/visible artwork must agree.
  const eagerArtwork = new Set([
    ...visibleArtwork,
    ...(featured?.fields.artwork ? [featured.fields.artwork] : []),
    ...firstTitles.slice(0, 6).flatMap((item) => item.fields.artwork ?? []),
  ]);
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
        display={display}
        eager={Boolean(item.fields.artwork && eagerArtwork.has(item.fields.artwork))}
      />
    ));
  return (
    <div
      ref={library}
      className={`libraryPage ${kind === 'game' ? 'gameLibrary' : 'screenLibrary'}`}
    >
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
          <div className="libraryHeroActions">
            <button type="button" className="primary" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden="true" />
              Add {kind === 'game' ? 'game' : 'title'}
            </button>
            <button
              type="button"
              className={`librarySync ${metadataSync ? 'librarySyncActive' : ''}`}
              aria-label={kind === 'game' ? 'Sync all games' : 'Sync all movies and series'}
              title={kind === 'game' ? 'Sync all games' : 'Sync all movies and series'}
              disabled={metadataSync || !relevant.some((item) => item.metadata_id)}
              onClick={() => void syncMetadata()}
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>
          {syncMessage && (
            <p className="librarySyncMessage" role="status">
              {syncMessage}
            </p>
          )}
          {syncFailed.length > 0 && (
            <button
              type="button"
              className="textButton"
              disabled={metadataSync}
              onClick={() => void syncMetadata(true)}
            >
              Retry failed syncs
            </button>
          )}
        </header>
        {featured && (
          <Link href={`/items/${featured.id}`} className="heroFeature">
            <Artwork
              url={featured.fields.artwork}
              title={featured.fields.title}
              kind={featured.kind}
              eager
              highPriority
              sizes="(max-width: 650px) calc(100vw - 32px), 40vw"
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
      <div className="libraryControls">
        <div className="toolbar">
          <label className="searchInput">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Search your library"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles…"
            />
          </label>
          <div className="libraryViewControls">
            <fieldset className="viewSwitcher" aria-label="Library grouping">
              {(kind === 'game' ? ['status', 'all'] : ['service', 'status', 'all']).map((v) => {
                const title =
                  v === 'status' ? 'Shelves' : v === 'service' ? 'Services' : 'All titles together';
                const Icon = v === 'status' ? Rows3 : v === 'service' ? MonitorPlay : Layers3;
                return (
                  <button
                    type="button"
                    aria-label={title}
                    title={title}
                    aria-pressed={view === v}
                    key={v}
                    onClick={() => setView(v)}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </fieldset>
            <fieldset className="viewSwitcher displaySwitcher" aria-label="Title display">
              {(['grid', 'list'] as const).map((style) => {
                const title = style === 'grid' ? 'Grid' : 'List';
                const Icon = style === 'grid' ? LayoutGrid : List;
                return (
                  <button
                    type="button"
                    aria-label={title}
                    title={title}
                    aria-pressed={display === style}
                    key={style}
                    onClick={() => setDisplay(style)}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </fieldset>
          </div>
        </div>
        <div className="libraryFilterRow">
          {kind === 'screen' && (
            <fieldset
              className="screenTypePicker libraryTypePicker"
              aria-label="Filter by title type"
            >
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
            <FilterSelect
              name="Filter by status"
              value={status}
              display={status ? label(status) : 'All statuses'}
              compactDisplay={status ? label(status) : 'Status'}
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
        </div>
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
      {shelfError && (
        <div className="shelfSyncError" role="alert">
          <p>{shelfError}</p>
          <button
            type="button"
            disabled={syncing}
            onClick={() => {
              failedLayouts.current.forEach((layout, key) => {
                queuedLayouts.current.set(key, layout);
              });
              void syncLayouts();
            }}
          >
            Retry sync
          </button>
        </div>
      )}
      {relevant.length === 0 ? (
        <div className="emptyState">
          <Image src="/icon.svg?v=2" alt="" width={48} height={48} unoptimized loading="eager" />
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
          collisionDetection={(args) => {
            const isShelf = args.active.data.current?.type === 'shelf';
            const candidates = args.droppableContainers.filter(
              (container) => (container.data.current?.type === 'shelf') === isShelf
            );
            if (!args.pointerCoordinates && keyboardTarget.current) {
              const target = candidates.find(
                (container) => container.id === keyboardTarget.current
              );
              if (target) return [{ id: target.id }];
            }
            return (isShelf || !args.pointerCoordinates ? closestCenter : rectIntersection)({
              ...args,
              droppableContainers: candidates,
            });
          }}
          onDragStart={({ active }) => {
            keyboardTarget.current = null;
            setDraggingShelf(
              active.data.current?.type === 'shelf' ? String(active.data.current.name) : null
            );
          }}
          onDragCancel={() => {
            keyboardTarget.current = null;
            setDraggingShelf(null);
          }}
          onDragEnd={({ active, over }) => {
            keyboardTarget.current = null;
            setDraggingShelf(null);
            if (active.data.current?.type === 'shelf') {
              if (over?.data.current?.type === 'shelf')
                reorderShelf(String(active.data.current.name), String(over.data.current.name));
            } else if (over && statuses.includes(String(over.id) as Status))
              move(String(active.data.current?.itemId), String(over.id) as Status);
          }}
        >
          {view === 'all' ? (
            <div className={`cardGrid flatGrid ${display === 'list' ? 'listGrid' : ''}`}>
              {cards(filtered)}
            </div>
          ) : (
            groups.map((group, index) => (
              <Shelf
                key={group.name}
                name={group.name}
                status={group.status}
                count={group.items.length}
                collapsed={currentLayout.collapsed.includes(group.name)}
                onToggle={() =>
                  updateLayout({
                    ...currentLayout,
                    collapsed: currentLayout.collapsed.includes(group.name)
                      ? currentLayout.collapsed.filter((name) => name !== group.name)
                      : [...currentLayout.collapsed, group.name],
                  })
                }
                onReorder={(direction) => {
                  const target = groups[index + direction];
                  if (target) reorderShelf(group.name, target.name);
                }}
                first={index === 0}
                last={index === groups.length - 1}
                display={display}
              >
                {cards(group.items, group.name)}
              </Shelf>
            ))
          )}
          <DragOverlay style={{ width: 'min(280px, calc(100vw - 32px))' }}>
            {draggingShelf && (
              <div className="shelfDragOverlay">
                <GripVertical size={18} aria-hidden="true" />
                {draggingShelf}
              </div>
            )}
          </DragOverlay>
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
      <div className="attribution">
        <Image src="/tmdb.svg" alt="TMDB" width={70} height={9} />
        <p>
          Game metadata:{' '}
          <a href="https://rawg.io" target="_blank" rel="noreferrer">
            RAWG
          </a>
          . Screen metadata and images:{' '}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
            TMDB
          </a>
          . Metascores: OMDb. This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
      </div>
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
            eagerArtwork={eagerArtwork}
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
