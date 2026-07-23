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
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 max-sm:w-full ${className}`}
    >
      <span aria-hidden="true">+</span>
      {label}
    </button>
  );
}
