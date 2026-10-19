'use client';

import ItemTile, { type ItemTileProps } from './ItemTile';

const GameTile = (props: ItemTileProps) => {
  const { item } = props;

  return (
    <ItemTile
      {...props}
      className="gameTile"
      metadata={item.platforms.join(' · ') || 'Platform not chosen'}
    />
  );
};

export default GameTile;
