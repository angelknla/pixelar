import LoadingState from './LoadingState';
import SkeletonBar from './SkeletonBar';
import LoadingHeading from './LoadingHeading';
import SkeletonField from './SkeletonField';

const ImportLoading = () => {
  return (
    <LoadingState label="Loading notes import">
      <LoadingHeading
        eyebrow="From your notes to your next night in"
        title="Bring your list along."
        description="Paste your notes, check the titles, and give them a new home."
      />
      <section className="importPaste">
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
