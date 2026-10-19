'use client';

import { serviceLabel } from '@/lib/library';
import ItemTile, { type ItemTileProps } from './ItemTile';

const ScreenTile = (props: ItemTileProps) => {
  const { item } = props;
  const services = [...new Set(item.services.map(serviceLabel))].join(' · ') || 'None';

  return (
    <ItemTile
      {...props}
      className="screenTile"
      metadata={`${item.kind === 'show' ? 'TV series' : 'Movie'} · ${services}`}
    />
  );
};

export default ScreenTile;
