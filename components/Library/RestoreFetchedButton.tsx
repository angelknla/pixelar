'use client';

const RestoreFetchedButton = ({
  available,
  disabled,
  onRestore,
}: {
  available: boolean;
  disabled: boolean;
  onRestore: () => void;
}) => {
  if (!available) return null;

  return (
    <button className="textButton" type="button" disabled={disabled} onClick={onRestore}>
      Use fetched value
    </button>
  );
};

export default RestoreFetchedButton;
