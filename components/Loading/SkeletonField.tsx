import SkeletonBar from './SkeletonBar';

const SkeletonField = ({ label, tall = false }: { label: string; tall?: boolean }) => {
  return (
    <div className="skeletonField">
      <span>{label}</span>
      <SkeletonBar className={tall ? 'skeletonTextarea' : 'skeletonInput'} />
    </div>
  );
};

export default SkeletonField;
