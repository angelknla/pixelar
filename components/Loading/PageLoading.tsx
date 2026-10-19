import LoadingState from './LoadingState';
import SkeletonBar from './SkeletonBar';

const PageLoading = () => {
  return (
    <LoadingState label="Loading Pixelar">
      <SkeletonBar className="skeletonEditorTitle" />
      <div className="skeletonHint">
        <SkeletonBar className="skeletonMedium" />
        <SkeletonBar className="skeletonShort" />
      </div>
    </LoadingState>
  );
};

export default PageLoading;
