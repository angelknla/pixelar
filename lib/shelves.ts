import type { ShelfLayout, ShelfLayouts, ShelfView } from '@/types/library';

const views: ShelfView[] = ['games_status', 'tv_status', 'tv_service'];

export const parseShelfLayout = (value: unknown): ShelfLayout => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid shelf layout.');

  const input = value as Record<string, unknown>;

  const list = (value: unknown) => {
    if (
      !Array.isArray(value) ||
      value.length > 100 ||
      value.some((key) => typeof key !== 'string' || !key.trim() || key.length > 80)
    )
      throw new Error('Invalid shelf layout.');

    return [...new Set(value)] as string[];
  };

  return { order: list(input.order), collapsed: list(input.collapsed) };
};

export const parseShelfView = (value: unknown): ShelfView => {
  if (!views.includes(value as ShelfView)) throw new Error('Invalid shelf view.');

  return value as ShelfView;
};

export const shelfLayout = (layouts: ShelfLayouts | undefined, view: ShelfView): ShelfLayout => {
  try {
    return parseShelfLayout(layouts?.[view]);
  } catch {
    return { order: [], collapsed: [] };
  }
};

export const orderedShelves = <T extends { name: string }>(groups: T[], order: string[]): T[] => {
  return [...groups].sort((a, b) => {
    const rank = (name: string) => {
      const index = order.indexOf(name);

      return index < 0 ? order.length : index;
    };

    return rank(a.name) - rank(b.name);
  });
};

export const reorderShelves = (order: string[], from: string, to: string) => {
  const next = [...order],
    source = next.indexOf(from),
    target = next.indexOf(to);

  if (source < 0 || target < 0 || source === target) return next;

  next.splice(source, 1);
  next.splice(target, 0, from);

  return next;
};
