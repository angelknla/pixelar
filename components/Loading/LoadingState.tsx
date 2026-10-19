import type { ReactNode } from 'react';

const LoadingState = ({
  children,
  label,
  className = '',
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) => {
  return (
    <div className={`loadingPage ${className}`} role="status" aria-busy="true">
      <span className="srOnly">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
};

export default LoadingState;
