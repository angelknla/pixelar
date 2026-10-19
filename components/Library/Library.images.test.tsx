import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImageProps } from 'next/image';
import { defaultProfile, EMPTY_FIELDS } from '@/lib/library';
import type { LibraryItem } from '@/types/library';
import Library from './Library';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/app/library-actions', () => ({
  saveItem: vi.fn(),
  moveItem: vi.fn(),
  deleteItem: vi.fn(),
  saveShelfLayout: vi.fn().mockResolvedValue({}),
}));
vi.mock('next/image', () => ({
  default: ({ fill, unoptimized, ...props }: ImageProps) => (
    // biome-ignore lint/performance/noImgElement: Exercise the loading attributes passed to Next Image.
    <img {...props} src={String(props.src)} alt={props.alt} />
  ),
}));

let visible: Set<string>;
let intersect: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();
beforeEach(() => {
  visible = new Set();
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe = observe;
      disconnect = disconnect;
    }
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const top =
      this.closest('.heroFeature') || visible.has(this.getAttribute('alt') ?? '') ? 0 : 10000;
    return {
      x: 0,
      y: top,
      top,
      bottom: top + 100,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      toJSON() {},
    };
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

function item(index: number, screen = false): LibraryItem {
  const title = `Title ${index}`;
  return {
    id: `item-${index}`,
    member_id: 'owner',
    kind: screen ? 'movie' : 'game',
    status: screen ? 'watchlist' : index === 12 ? 'playing' : 'anticipated',
    metadata_id: null,
    metadata: null,
    overrides: { title },
    fields: { ...EMPTY_FIELDS, title, artwork: `https://media.rawg.io/media/games/${index}.jpg` },
    platforms: [],
    services: screen ? ['Netflix', 'Prime Video'] : [],
    price: null,
    currency: 'GBP',
    notes: '',
    auto_move: true,
    created_at: '2026-10-19',
    updated_at: '2026-10-19',
  };
}
function images(title: string) {
  return screen.getAllByRole('img', { name: title });
}
function expectLoading(title: string, loading: 'eager' | 'lazy') {
  for (const image of images(title)) expect(image).toHaveAttribute('loading', loading);
}
function library(screen = false) {
  return render(
    <Library
      items={Array.from({ length: 18 }, (_, index) => item(index, screen))}
      profile={defaultProfile('owner')}
      kind={screen ? 'screen' : 'game'}
    />
  );
}

it('keeps the hero URL eager in every shelf, with one high-priority hero and lazy distant artwork', () => {
  library();
  expectLoading('Title 12', 'eager');
  expect(
    images('Title 12').filter((image) => image.getAttribute('fetchpriority') === 'high')
  ).toHaveLength(1);
  expectLoading('Title 0', 'eager');
  expectLoading('Title 7', 'lazy');
  expectLoading('Title 17', 'lazy');
});

it('promotes visible images beyond six columns and shares that setting across service shelves', () => {
  visible.add('Title 8');
  library(true);
  expect(images('Title 8')).toHaveLength(2);
  expectLoading('Title 8', 'eager');
  expectLoading('Title 9', 'lazy');
});

it('promotes artwork when scrolling into view and disconnects observers on unmount', () => {
  const view = library(true);
  expectLoading('Title 9', 'lazy');
  act(() =>
    intersect(
      [
        {
          isIntersecting: true,
          target: images('Title 9')[0],
          boundingClientRect: images('Title 9')[0].getBoundingClientRect(),
          intersectionRect: images('Title 9')[0].getBoundingClientRect(),
          intersectionRatio: 1,
          rootBounds: null,
          time: 0,
        },
      ],
      {} as IntersectionObserver
    )
  );
  expectLoading('Title 9', 'eager');
  expectLoading('Title 10', 'lazy');
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
});

it('rescans after filtering, switching views and resizing without making distant images eager', async () => {
  library();
  fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search your library' }), {
    target: { value: 'Title 1' },
  });
  await waitFor(() => expect(observe).toHaveBeenCalledWith(images('Title 17')[0]));
  expectLoading('Title 17', 'lazy');
  visible.add('Title 17');
  fireEvent(window, new Event('resize'));
  expectLoading('Title 17', 'eager');
});

it('keeps a shared hero URL eager when it also appears below the first search results', async () => {
  const results = Array.from({ length: 8 }, (_, index) => ({
    provider: 'rawg',
    provider_id: String(index),
    title: `Result ${index}`,
    kind: 'game',
    year: 2026,
    artwork:
      index === 7
        ? item(12).fields.artwork
        : `https://media.rawg.io/media/games/result-${index}.jpg`,
  }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results }) }));
  library();
  fireEvent.click(screen.getByRole('button', { name: 'Add game' }));
  fireEvent.change(screen.getByPlaceholderText('Search a title…'), { target: { value: 'Fable' } });
  fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));
  await screen.findByRole('img', { name: 'Result 7' });
  expectLoading('Result 7', 'eager');
  expectLoading('Result 0', 'eager');
  expectLoading('Result 5', 'lazy');
  expect(images('Result 0')[0]).toHaveAttribute('sizes', '50px');
});
