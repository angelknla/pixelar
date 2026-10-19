'use client';

import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { label, releaseLabel, statusesFor } from '@/lib/library';
import type { LibraryItem, ProfileRow, Status } from '@/types/library';
import Artwork from './Artwork';
import Countdown from './Countdown';

export interface ItemTileProps {
  item: LibraryItem;
  profile: ProfileRow;
  move: (id: string, status: Status) => void;
  pending: boolean;
  onRemove: (item: LibraryItem) => void;
  group?: string;
}

export default function ItemTile({
  item,
  profile,
  move,
  pending,
  onRemove,
  group = 'grid',
  className,
  metadata,
}: ItemTileProps & {
  className: string;
  metadata: string;
}) {
  const drag = useDraggable({ id: `${group}:${item.id}`, data: { itemId: item.id } });
  const release = releaseLabel(item.fields);
  const compactRelease =
    item.fields.release_date && item.fields.release_precision === 'day'
      ? new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'numeric',
          year: '2-digit',
          timeZone: 'UTC',
        })
          .format(new Date(`${item.fields.release_date}T12:00:00Z`))
          .replace(/(^|\/)0(?=\d)/g, '$1')
      : release;
  return (
    <article
      ref={drag.setNodeRef}
      className={`itemCard ${className} status-${item.status} ${drag.isDragging ? 'dragging' : ''}`}
      style={
        drag.transform
          ? { transform: `translate3d(${drag.transform.x}px,${drag.transform.y}px,0)`, zIndex: 20 }
          : undefined
      }
    >
      <Link href={`/items/${item.id}`} className="cardArtLink" aria-label={item.fields.title}>
        <Artwork
          url={item.fields.artwork}
          title={item.fields.title}
          kind={item.kind}
          sizes={item.kind === 'game' ? '(max-width: 650px) 45vw, 360px' : undefined}
        />
        {item.fields.metascore !== null && (
          <span className="metascore" role="img" aria-label={`Metacritic ${item.fields.metascore}`}>
            {item.fields.metascore}
          </span>
        )}
      </Link>
      <div className="cardBody">
        <div className="cardTop">
          <Link href={`/items/${item.id}`} title={item.fields.title}>
            <h3>{item.fields.title}</h3>
          </Link>
          <div className="cardActions">
            <button
              type="button"
              className="dragHandle"
              {...drag.attributes}
              {...drag.listeners}
              aria-label={`Drag ${item.fields.title} to a status shelf`}
            >
              <GripVertical size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="removeTile"
              aria-label={`Remove ${item.fields.title}`}
              title="Remove title"
              disabled={pending}
              onClick={() => onRemove(item)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="cardMeta" title={metadata}>
          {metadata}
        </p>
        <div className="cardRelease">
          {item.fields.release_date && (
            <p className="cardDate" title={release}>
              <span className="srOnly">{release}</span>
              <span className="cardDateFull" aria-hidden="true">
                {release}
              </span>
              <span className="cardDateCompact" aria-hidden="true">
                {compactRelease}
              </span>
            </p>
          )}
          <Countdown fields={item.fields} timezone={profile.timezone} />
        </div>
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
        </div>
      </div>
    </article>
  );
}
