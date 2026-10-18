import { fireEvent, render, screen, within } from '@testing-library/react';
import { defaultProfile, EMPTY_FIELDS } from '@/lib/library';
import type { LibraryItem } from '@/types/library';
import Library from './Library';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/library-actions', () => ({ moveItem: vi.fn() }));
vi.mock('./ItemEditor', () => ({ default: () => null }));
vi.mock('./Artwork', () => ({ default: () => null }));
vi.mock('./Countdown', () => ({ default: () => null }));

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: vi.fn(),
    configurable: true,
  });
});
afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('offers platform choices before any games have platform assignments', () => {
  const profile = { ...defaultProfile('owner'), platforms: ['Retro handheld'] };
  render(<Library items={[]} profile={profile} kind="game" />);
  const filter = screen.getByRole('combobox', { name: 'Filter by platform' });
  expect(within(filter).getByRole('option', { name: 'PC' })).toBeInTheDocument();
  expect(within(filter).getByRole('option', { name: 'PlayStation 5' })).toBeInTheDocument();
  expect(within(filter).getByRole('option', { name: 'Retro handheld' })).toBeInTheDocument();
});

it('filters assigned platforms and falls back to fetched platforms for unassigned games', () => {
  const item: LibraryItem = {
    id: 'one',
    member_id: 'owner',
    kind: 'game',
    status: 'backlog',
    metadata_id: null,
    metadata: null,
    overrides: { title: 'PC title' },
    fields: { ...EMPTY_FIELDS, title: 'PC title' },
    platforms: ['PC'],
    services: [],
    price: null,
    currency: 'GBP',
    notes: '',
    auto_move: true,
    created_at: '2026-10-18',
    updated_at: '2026-10-18',
  };
  const unmatched: LibraryItem = {
    ...item,
    id: 'two',
    platforms: [],
    fields: { ...EMPTY_FIELDS, title: 'Fetched game' },
    metadata_id: 'metadata',
    metadata: {
      id: 'metadata',
      provider: 'rawg',
      provider_id: '1',
      kind: 'game',
      region: 'GB',
      fetched_at: '2026-10-18',
      fields: {
        ...EMPTY_FIELDS,
        title: 'Fetched game',
        kind: 'game',
        platforms: ['Nintendo Switch'],
        services: [],
        source_url: 'https://rawg.io',
      },
    },
  };
  render(<Library items={[item, unmatched]} profile={defaultProfile('owner')} kind="game" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by platform' }), {
    target: { value: 'Nintendo Switch' },
  });
  expect(screen.getByRole('heading', { name: 'Fetched game' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'PC title' })).not.toBeInTheDocument();
});
