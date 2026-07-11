import { Loader2, Trash2, Upload } from 'lucide-react';

type ImageUploadPanelProps = {
  title: string;
  description: string;
  imageUrl?: string | null;
  fallbackName: string;
  alt?: string;
  uploadLabel?: string;
  replaceLabel?: string;
  removeLabel?: string;
  uploadingLabel?: string;
  removingLabel?: string;
  uploading?: boolean;
  removing?: boolean;
  disabled?: boolean;
  removeDisabled?: boolean;
  onUploadClick: () => void;
  onRemoveClick: () => void;
  className?: string;
  previewClassName?: string;
};

function getInitials(name: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'IM';
}

export function ImageUploadPanel({
  title,
  description,
  imageUrl,
  fallbackName,
  alt,
  uploadLabel = 'Inserir',
  replaceLabel = 'Trocar',
  removeLabel = 'Remover',
  uploadingLabel = 'Enviando...',
  removingLabel = 'Removendo...',
  uploading = false,
  removing = false,
  disabled = false,
  removeDisabled = false,
  onUploadClick,
  onRemoveClick,
  className = '',
  previewClassName = 'h-16 w-16 rounded-2xl',
}: ImageUploadPanelProps) {
  const busy = uploading || removing || disabled;

  return (
    <div className={`rounded-2xl border border-gray-100 bg-gray-50 p-4 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className={`flex shrink-0 overflow-hidden border border-gray-200 bg-white ${previewClassName}`}>
            {imageUrl ? (
              <img src={imageUrl} alt={alt || fallbackName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-indigo-50 text-sm font-bold text-indigo-700">
                {getInitials(fallbackName)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={onUploadClick}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? uploadingLabel : imageUrl ? replaceLabel : uploadLabel}
          </button>
          <button
            type="button"
            onClick={onRemoveClick}
            disabled={busy || removeDisabled}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {removing ? removingLabel : removeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
