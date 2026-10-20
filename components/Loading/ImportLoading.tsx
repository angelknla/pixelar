import LoadingHeading from './LoadingHeading';
import LoadingState from './LoadingState';
import SkeletonBar from './SkeletonBar';
import SkeletonField from './SkeletonField';

const ImportLoading = () => {
  return (
    <LoadingState label="Loading notes import">
      <LoadingHeading
        eyebrow="From your notes to your next night in"
        title="Bring your list along."
        description="Paste your notes. We’ll find matches so you can focus on the titles that need a decision."
      />
      <section className="importPaste">
        <SkeletonField label="Default type" />
        <SkeletonField label="Your notes" tall />
        <div className="skeletonHint">
          <SkeletonBar />
          <SkeletonBar className="skeletonMedium" />
        </div>
        <SkeletonBar className="skeletonButton" />
      </section>
    </LoadingState>
  );
};

export default ImportLoading;
