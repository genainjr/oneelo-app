interface PrintFooterProps {
  printedAt: Date;
}

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
}

export function PrintScheduleHeader({ title, subtitle }: PrintHeaderProps) {
  return (
    <header className="print-schedule-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}

export function PrintScheduleFooter({ printedAt }: PrintFooterProps) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(printedAt);

  return (
    <footer className="print-schedule-footer">
      <div className="print-schedule-footer-brand">
        <img src="/logo.jpg" alt="Lookup Labs" className="print-schedule-footer-logo" />
        <div className="print-schedule-footer-text">
          <span className="print-schedule-footer-company">Lookup Labs</span>
          <span className="print-schedule-footer-product">One Elo</span>
        </div>
      </div>
      <span>Impresso em {formatted}</span>
    </footer>
  );
}
