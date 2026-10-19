import LoadingState from './LoadingState';
import SkeletonBar from './SkeletonBar';
import SkeletonField from './SkeletonField';
import SkeletonChips from './SkeletonChips';

const ItemLoading = () => {
  return (
    <LoadingState label="Loading title details">
      <SkeletonBar className="skeletonBack" />
      <div className="editor itemDetails">
        <header className="itemOverview">
          <div className="itemDetailArtwork detailGameArt">
            <div className="artwork skeleton" />
          </div>
          <div className="itemOverviewBody">
            <SkeletonBar className="skeletonShort" />
            <SkeletonBar className="skeletonEditorTitle" />
            <div className="itemOverviewMeta">
              <SkeletonBar className="skeletonChip" />
              <SkeletonBar className="skeletonStat" />
            </div>
          </div>
        </header>
        <SkeletonBar className="skeletonInput skeletonHint" />
        <div className="itemDetailForm skeletonForm">
          <div className="itemDetailColumns">
            <div className="itemDetailMain">
              <fieldset className="editorSection">
                <legend>Your library</legend>
                <SkeletonField label="Title" />
                <SkeletonField label="Status" />
                <SkeletonChips />
                <div className="formGrid">
                  <SkeletonField label="Price (optional)" />
                  <SkeletonField label="Currency" />
                </div>
              </fieldset>
            </div>
            <fieldset className="editorSection itemDetailRelease">
              <legend>Release & reminders</legend>
              <SkeletonField label="Release precision" />
              <SkeletonField label="Release date" />
              <SkeletonBar />
              <SkeletonField label="Reminders" />
            </fieldset>
          </div>
          <div className="itemDetailPersonal">
            <fieldset className="editorSection">
              <legend>My notes</legend>
              <SkeletonBar className="skeletonTextarea" />
            </fieldset>
            <fieldset className="editorSection">
              <legend>Cover image</legend>
              <SkeletonBar className="skeletonButton" />
              <SkeletonField label="Cover / poster URL" />
            </fieldset>
          </div>
          <SkeletonBar className="skeletonInput" />
          <div className="itemDetailActions formActions">
            <SkeletonBar className="skeletonButton" />
          </div>
        </div>
      </div>
    </LoadingState>
  );
};

export default ItemLoading;
