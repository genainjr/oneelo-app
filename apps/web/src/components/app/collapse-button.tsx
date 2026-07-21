interface CollapseButtonProps {
  collapsed: boolean;
  onToggle: () => void;
  collapseLabel: string;
  expandLabel: string;
  className?: string;
}

export function CollapseButton({
  collapsed,
  onToggle,
  collapseLabel,
  expandLabel,
  className = '',
}: CollapseButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className={`shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-xs transition hover:bg-gray-50 ${className}`}
    >
      {collapsed ? expandLabel : collapseLabel}
    </button>
  );
}
