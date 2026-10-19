import LoadingState from './LoadingState';
import SkeletonBar from './SkeletonBar';
import SkeletonTile from './SkeletonTile';
import styles from './LibraryLoading.module.css';

const LibraryLoading = ({ kind }: { kind: 'game' | 'screen' }) => {
  const game = kind === 'game';

  return (
    <LoadingState label={`Loading your ${game ? 'games' : 'movies and TV series'}`}>
      <div className={`libraryPage ${game ? 'gameLibrary' : 'screenLibrary'}`}>
        <section className="libraryHero">
          <header className="pageHeading">
            <div>
              <span className="eyebrow">Your collection</span>
              <h1>{game ? 'Game library' : 'Movies & TV'}</h1>
              <p>
                {game
                  ? 'Pick up where you left off. Find your next adventure.'
                  : 'Your next movie night. Your next must-watch series.'}
              </p>
            </div>
            <SkeletonBar className="skeletonButton" />
          </header>
          <div className="heroFeature">
            <div className="artwork skeleton" />
            <div className="heroFeatureCaption">
              <SkeletonBar className="skeletonChip" />
              <SkeletonBar className="skeletonHeroTitle" />
              <SkeletonBar className="skeletonShort" />
            </div>
          </div>
        </section>
        <div className="libraryStats">
          <SkeletonBar className="skeletonStat" />
          <SkeletonBar className="skeletonStat" />
          <SkeletonBar className="skeletonStat skeletonStatLink" />
        </div>
        <div className="libraryControls">
          <div className="toolbar">
            <SkeletonBar className="skeletonSearch" />
            <div className="skeletonViews">
              {Array.from({ length: game ? 2 : 3 }, (_, i) => (
                <SkeletonBar className="skeletonView" key={i} />
              ))}
            </div>
          </div>
          <div className="libraryFilterRow">
            {!game && (
              <div className="screenTypePicker libraryTypePicker skeletonTypes">
                <span>All titles</span>
                <span>Movies</span>
                <span>TV series</span>
              </div>
            )}
            <div className="filters">
              <SkeletonBar className="skeletonFilter" />
              <SkeletonBar className="skeletonFilter" />
              <SkeletonBar className="skeletonFilter" />
              <span className="filterCount">
                <SkeletonBar className="skeletonCount" />
              </span>
            </div>
          </div>
        </div>
        {Array.from({ length: 2 }, (_, shelf) => (
          <section className="shelf" key={shelf}>
            <div className="shelfHeading">
              <div className="skeletonShelfHeading">
                <span className="shelfDot" />
                <SkeletonBar className="skeletonShelfTitle" />
                <SkeletonBar className="skeletonCount" />
              </div>
            </div>
            <div className={`cardGrid listGrid ${styles.mobileList}`}>
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonTile game={game} display="list" key={i} />
              ))}
            </div>
            <div className={styles.desktopGrid}>
              {game ? (
                <div className="cardGrid">
                  {Array.from({ length: 6 }, (_, i) => (
                    <SkeletonTile game key={i} />
                  ))}
                </div>
              ) : (
                <div className="skeletonPosterRows">
                  {Array.from({ length: 2 }, (_, row) => (
                    <div className="cardGrid skeletonPosterRow" key={row}>
                      {Array.from({ length: 16 }, (_, i) => (
                        <SkeletonTile game={false} key={i} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </LoadingState>
  );
};

export default LibraryLoading;
