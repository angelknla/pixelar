export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your collection">
      <div className="skeleton skeletonTitle" />
      <div className="skeleton skeletonToolbar" />
      <div className="cardGrid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton skeletonCard" />
        ))}
      </div>
      <span className="srOnly">Loading…</span>
    </div>
  );
}
