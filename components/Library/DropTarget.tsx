'use client';

import { useDroppable } from '@dnd-kit/core';
import { label } from '@/lib/library';
import type { Status } from '@/types/library';

const DropTarget = ({ status }: { status: Status }) => {
  const drop = useDroppable({ id: status });

  return (
    <div
      ref={drop.setNodeRef}
      className={`dropTarget status-${status} ${drop.isOver ? 'dropOver' : ''}`}
    >
      {label(status)}
    </div>
  );
};

export default DropTarget;
