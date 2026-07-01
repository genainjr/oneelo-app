interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  stackActionsOnMobile?: boolean;
}

export function PageHeader({ title, description, action, stackActionsOnMobile = false }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 ${stackActionsOnMobile ? 'max-sm:flex-col' : ''}`}>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className={`flex-shrink-0 ${stackActionsOnMobile ? 'max-sm:w-full max-sm:self-end' : ''}`}>{action}</div>}
    </div>
  );
}
