interface PrintFooterProps {
  printedAt: Date;
}

interface PrintHeaderProps {
  organizationName: string;
  documentTitle: string;
  period: string;
  logoUrl?: string | null;
}

export function PrintDocumentHeader({
  organizationName,
  documentTitle,
  period,
  logoUrl,
}: PrintHeaderProps) {
  return (
    <header className="print-document-header">
      {logoUrl && (
        <img
          src={logoUrl}
          alt={`Logo de ${organizationName}`}
          className="print-document-header-logo"
        />
      )}
      <div className="print-document-header-content">
        <h1>{documentTitle}</h1>
      </div>
      <div className="print-document-header-meta">
        <p className="print-document-header-period">{period}</p>
        <p className="print-document-header-organization">{organizationName}</p>
      </div>
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
        <img src="/logo.jpg" alt="One Elo" className="print-schedule-footer-logo" />
        <div className="print-schedule-footer-text">
          <span className="print-schedule-footer-product">One Elo</span>
          <span className="print-schedule-footer-company">Lookup Labs</span>
        </div>
      </div>
      <span>Impresso em {formatted}</span>
    </footer>
  );
}
