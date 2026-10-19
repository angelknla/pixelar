import SkeletonBar from './SkeletonBar';

const SkeletonChips = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="skeletonChips">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBar className="skeletonChip" key={i} />
      ))}
    </div>
  );
};

export default SkeletonChips;
