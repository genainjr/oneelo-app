type PrimaryActionButtonProps = {
  label: string;
  onClick: () => void;
  className?: string;
};

export function PrimaryActionButton({ label, onClick, className = "" }: PrimaryActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition-all hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 max-sm:w-full ${className}`}
    >
      <span aria-hidden="true">+</span>
      {label}
    </button>
  );
}
