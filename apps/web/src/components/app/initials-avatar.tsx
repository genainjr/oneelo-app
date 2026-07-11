/**
 * Avatar circular com imagem ou iniciais de fallback.
 */
export function InitialsAvatar({ name, src, alt }: { name: string; src?: string | null; alt?: string }) {
  if (src) {
    return (
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
        <img src={src} alt={alt || name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold uppercase text-indigo-700">
      {name.substring(0, 2)}
    </div>
  );
}
