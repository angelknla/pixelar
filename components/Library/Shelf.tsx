'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import type { Status } from '@/types/library';

const Shelf = ({
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
  children: ReactNode;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onReorder: (direction: number) => void;
  first: boolean;
  last: boolean;
  display: 'grid' | 'list';
}) => {
  const contentId = useId();
  const target = useDroppable({ id: `shelf:${name}`, data: { type: 'shelf', name } });
  const drag = useDraggable({ id: `shelf:${name}`, data: { type: 'shelf', name } });

  return (
    <section
      className={`shelf ${status ? `status-${status}` : ''} ${collapsed ? 'shelfCollapsed' : ''} ${target.isOver ? 'shelfReorderTarget' : ''}`}
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
};

export default Shelf;
