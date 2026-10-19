import type { KeyboardCoordinateGetter } from '@dnd-kit/core';

// Jump between visible shelves rather than asking keyboard users to move a card pixel by pixel.
export const createShelfKeyboardCoordinates =
  (onTarget?: (id: string) => void): KeyboardCoordinateGetter =>
  (event, { context, currentCoordinates }) => {
    const direction = ['ArrowDown', 'ArrowRight'].includes(event.code)
      ? 1
      : ['ArrowUp', 'ArrowLeft'].includes(event.code)
        ? -1
        : 0;

    if (!direction) return;

    const targets = context.droppableContainers
      .getEnabled()
      .filter(
        (container) =>
          (container.data.current?.type === 'shelf') ===
          (context.active?.data.current?.type === 'shelf')
      )
      .flatMap((container) => {
        const rect = context.droppableRects.get(container.id);

        return rect ? [{ id: container.id, rect }] : [];
      })
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

    if (!targets.length) return;

    event.preventDefault();

    let index = targets.findIndex((target) => target.id === context.over?.id);

    if (index < 0) {
      const active = context.collisionRect;

      index = active
        ? targets.reduce(
            (best, target, i) =>
              Math.abs(target.rect.top - active.top) < Math.abs(targets[best].rect.top - active.top)
                ? i
                : best,
            0
          )
        : 0;
    }

    const target = targets[Math.max(0, Math.min(targets.length - 1, index + direction))];

    onTarget?.(String(target.id));

    const active = context.collisionRect;

    if (!active) return currentCoordinates;

    return {
      x:
        currentCoordinates.x +
        target.rect.left +
        target.rect.width / 2 -
        active.left -
        active.width / 2,
      y:
        currentCoordinates.y +
        target.rect.top +
        target.rect.height / 2 -
        active.top -
        active.height / 2,
    };
  };

export const shelfKeyboardCoordinates = createShelfKeyboardCoordinates();
