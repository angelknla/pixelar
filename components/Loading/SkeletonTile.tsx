import SkeletonBar from './SkeletonBar';

const SkeletonTile = ({ game, display = 'grid' }: { game: boolean; display?: 'grid' | 'list' }) => {
  return (
    <div
      className={`itemCard skeletonTile ${game ? 'gameTile' : 'screenTile'} ${display === 'list' ? 'listTile' : ''}`}
    >
      <div className="cardArtLink">
        <div className={`artwork skeleton ${game ? 'gameArt' : 'screenArt'}`} />
      </div>
      <div className="cardBody">
        <div className="cardTop">
          <div className="skeletonTileTitle">
            <SkeletonBar />
            <SkeletonBar className="skeletonShort" />
          </div>
          <SkeletonBar className="skeletonGrip" />
        </div>
        <div className="cardMeta">
          <SkeletonBar className="skeletonMedium" />
        </div>
        <div className="cardRelease">
          <SkeletonBar className="skeletonDate" />
          <SkeletonBar className="skeletonCounter" />
        </div>
        <div className="cardFoot">
          <SkeletonBar className="skeletonInput" />
        </div>
      </div>
    </div>
  );
};

export default SkeletonTile;
