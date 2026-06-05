interface FlagProps {
  className?: string;
}

function BrFlag({ className }: FlagProps) {
  return (
    <svg viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="20" height="14" fill="#009C3B" />
      <polygon points="10,1.2 18.5,7 10,12.8 1.5,7" fill="#FFDF00" />
      <circle cx="10" cy="7" r="3.4" fill="#002776" />
      <path d="M6.8,8.3 Q10,6.2 13.2,8.3" fill="none" stroke="white" strokeWidth="0.9" />
    </svg>
  );
}

function PtFlag({ className }: FlagProps) {
  return (
    <svg viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="20" height="14" fill="#FF0000" />
      <rect width="8" height="14" fill="#006600" />
      <circle cx="8" cy="7" r="2.8" fill="#FFD700" />
      <circle cx="8" cy="7" r="1.8" fill="#FF0000" />
      <ellipse cx="8" cy="7" rx="2.8" ry="1.1" fill="none" stroke="#FFD700" strokeWidth="0.5" />
    </svg>
  );
}

function UsFlag({ className }: FlagProps) {
  const stripeH = 14 / 13;
  return (
    <svg viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="20" height="14" fill="white" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} x="0" y={i * stripeH} width="20" height={stripeH} fill="#B22234" />
      ))}
      <rect x="0" y="0" width="8" height={stripeH * 7} fill="#3C3B6E" />
    </svg>
  );
}

export function FlagIcon({ locale, className }: { locale: string; className?: string }) {
  if (locale === 'pt-BR') return <BrFlag className={className} />;
  if (locale === 'pt-PT') return <PtFlag className={className} />;
  return <UsFlag className={className} />;
}
