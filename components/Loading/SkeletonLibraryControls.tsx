import SkeletonBar from './SkeletonBar';
import styles from './SkeletonLibraryControls.module.css';

const SkeletonLibraryControls = ({ kind }: { kind: 'game' | 'screen' }) => {
  const game = kind === 'game';

  return (
    <div className={`libraryControls ${styles.controls}`} aria-hidden="true">
      <div className="toolbar">
        <SkeletonBar className="skeletonSearch" />
        <div className="libraryViewControls">
          <div className="viewSwitcher skeletonViews">
            {Array.from({ length: game ? 2 : 3 }, (_, i) => (
              <SkeletonBar className="skeletonView" key={i} />
            ))}
          </div>
          <div className="viewSwitcher displaySwitcher skeletonViews">
            {Array.from({ length: 2 }, (_, i) => (
              <SkeletonBar className="skeletonView" key={i} />
            ))}
          </div>
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
  );
};

export default SkeletonLibraryControls;
