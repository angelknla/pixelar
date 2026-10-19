'use client';

import ItemTile, { type ItemTileProps } from './ItemTile';

export default function GameTile(props: ItemTileProps) {
  const { item } = props;
  return (
    <ItemTile
      {...props}
      className="gameTile"
      metadata={item.platforms.join(' · ') || 'Platform not chosen'}
    />
  );
}
