'use client';

import type { ReactNode } from 'react';

const FilterSelect = ({
  name,
  value,
  display,
  compactDisplay = display,
  onChange,
  children,
}: {
  name: string;
  value: string;
  display: string;
  compactDisplay?: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) => {
  return (
    <div className="filterSelect">
      <span className="filterValue" aria-hidden="true">
        {display}
      </span>
      <span className="filterCompactValue" aria-hidden="true">
        {compactDisplay}
      </span>
      <select
        aria-label={name}
        title={`${name}: ${display}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
};

export default FilterSelect;
