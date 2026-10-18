import type { ItemKind, ProviderMetadata, SearchResult } from '@/types/library';
export interface MetadataProvider {
  search(query: string, kind: ItemKind, region: string): Promise<SearchResult[]>;
  details(id: string, kind: ItemKind, region: string): Promise<ProviderMetadata>;
}
export interface PriceProvider {
  quote(id: string, currency: string): Promise<{ amount: number; currency: string } | null>;
}
export const manualPriceProvider: PriceProvider = {
  async quote() {
    return null;
  },
};
