import React from 'react';

export interface InfoItemProps {
  label: string;
  value: React.ReactNode;
  className?: string;
  as?: 'div' | 'dl-item';
}

export function InfoItem({ label, value, className = '', as = 'div' }: InfoItemProps) {
  const labelClass = "text-[11px] font-bold uppercase tracking-wide text-gray-400";
  const valueClass = "mt-1 text-sm font-semibold text-gray-800 break-words";

  const content = (
    <>
      {as === 'dl-item' ? (
        <>
          <dt className={labelClass}>{label}</dt>
          <dd className={valueClass}>{value}</dd>
        </>
      ) : (
        <>
          <p className={labelClass}>{label}</p>
          <p className={valueClass}>{value}</p>
        </>
      )}
    </>
  );

  return (
    <div className={`rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 ${className}`}>
      {content}
    </div>
  );
}
