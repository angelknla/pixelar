export type ItemKind = 'game' | 'movie' | 'show';

export type LibraryKind = 'game' | 'screen';

export type BannerItems = Partial<Record<LibraryKind, string | null>>;

export type Provider = 'rawg' | 'tmdb';

export type Precision = 'unknown' | 'year' | 'month' | 'day';

export type GameStatus =
  | 'anticipated'
  | 'scheduled'
  | 'backlog'
  | 'playing'
  | 'replay'
  | 'completed'
  | 'dropped';

export type ScreenStatus = 'upcoming' | 'watchlist' | 'watching' | 'watched' | 'dropped';

export type Status = GameStatus | ScreenStatus;

export interface MetadataFields {
  title: string;
  artwork: string | null;
  description: string | null;
  publisher: string | null;
  release_date: string | null;
  release_precision: Precision;
  metascore: number | null;
}

export interface ProviderMetadata extends MetadataFields {
  kind: ItemKind;
  platforms: string[];
  services: string[];
  source_url: string;
}

export interface MetadataRow {
  id: string;
  provider: Provider;
  provider_id: string;
  kind: ItemKind;
  region: string;
  fields: ProviderMetadata;
  fetched_at: string;
}

export interface ItemRow {
  id: string;
  member_id: string;
  kind: ItemKind;
  status: Status;
  metadata_id: string | null;
  overrides: Partial<MetadataFields>;
  platforms: string[];
  services: string[];
  price: number | null;
  currency: string;
  notes: string;
  auto_move: boolean;
  created_at: string;
  updated_at: string;
}

export interface LibraryItem extends ItemRow {
  fields: MetadataFields;
  metadata: MetadataRow | null;
}

export interface ProfileRow {
  member_id: string;
  region: string;
  currency: string;
  timezone: string;
  platforms: string[];
  services: string[];
  notifications_enabled: boolean;
  default_release_reminder: boolean;
  theme: 'system' | 'light' | 'dark';
  avatar_path: string | null;
  shelf_layouts?: ShelfLayouts;
  banner_items?: BannerItems;
}

export interface ShelfLayout {
  order: string[];
  collapsed: string[];
}

export type ShelfView = 'games_status' | 'tv_status' | 'tv_service';

export type ShelfLayouts = Partial<Record<ShelfView, ShelfLayout>>;

export interface ReminderRow {
  id: string;
  item_id: string;
  member_id: string;
  days_before: number;
  enabled: boolean;
  channel: 'in_app';
}

export interface NotificationRow {
  id: string;
  member_id: string;
  item_id: string;
  title: string;
  delivery_key: string;
  created_at: string;
  read_at: string | null;
}

export interface SearchResult {
  provider: Provider;
  provider_id: string;
  kind: ItemKind;
  title: string;
  artwork: string | null;
  year: string | null;
}

export interface ItemInput {
  id?: string;
  kind: ItemKind;
  status: Status;
  metadata_id: string | null;
  overrides: Partial<MetadataFields>;
  platforms: string[];
  services: string[];
  price: number | null;
  currency: string;
  notes: string;
  auto_move: boolean;
  reminder_days: number[];
}
