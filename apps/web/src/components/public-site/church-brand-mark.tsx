import Image from 'next/image';
import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Emblema arquitetônico minimalista de igreja (portal em arco + cruz sutil),
 * usado como fallback elegante quando a igreja ainda não cadastrou logo própria.
 */
export function ChurchEmblemIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Portal / nave em arco limpo */}
      <path d="M4.5 20.5h15" />
      <path d="M6.5 20.5v-8.25a5.5 5.5 0 0 1 11 0v8.25" />
      {/* Cruz central discreta e equilibrada */}
      <path d="M12 3.25v11.5" />
      <path d="M9.25 7h5.5" />
    </svg>
  );
}

export function InstagramIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.25" cy="6.75" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YouTubeIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect width="20" height="14" x="2" y="5" rx="4" ry="4" />
      <polygon points="10,9 15.5,12 10,15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsAppIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M12.04 2a9.9 9.9 0 0 0-8.48 15.01L2.25 22l5.13-1.35A9.92 9.92 0 1 0 12.04 2Zm0 18.08a8.15 8.15 0 0 1-4.15-1.14l-.3-.18-3.04.8.81-2.96-.19-.31a8.18 8.18 0 1 1 6.87 3.79Zm4.49-6.12c-.25-.12-1.45-.71-1.68-.8-.22-.08-.39-.12-.55.13s-.64.8-.78.96c-.14.17-.29.19-.54.06a6.68 6.68 0 0 1-1.97-1.22 7.36 7.36 0 0 1-1.36-1.7c-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.31 2.75 2.75 0 0 0-.86 2.04 4.78 4.78 0 0 0 1 2.54 10.95 10.95 0 0 0 4.19 3.71c.58.25 1.04.4 1.39.51.59.19 1.12.16 1.54.1.47-.07 1.45-.59 1.66-1.17.2-.57.2-1.07.14-1.17-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  );
}

const SIZE_CLASSES = {
  sm: {
    box: 'h-10 w-10',
    imgSize: 40,
    icon: 'h-5 w-5',
  },
  md: {
    box: 'h-11 w-11',
    imgSize: 44,
    icon: 'h-5 w-5',
  },
  lg: {
    box: 'h-16 w-16',
    imgSize: 64,
    icon: 'h-7 w-7',
  },
} as const;

export function ChurchBrandMark({
  logoUrl,
  churchName,
  size = 'sm',
  className,
}: {
  logoUrl?: string | null;
  churchName: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const dimensions = SIZE_CLASSES[size];

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--site-accent,#fbbf24)_50%,transparent)] bg-zinc-900 ring-2 ring-[color-mix(in_srgb,var(--site-accent,#fbbf24)_15%,transparent)]',
        dimensions.box,
        className,
      )}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={churchName}
          width={dimensions.imgSize}
          height={dimensions.imgSize}
          className="h-full w-full object-cover"
        />
      ) : (
        <ChurchEmblemIcon
          className={cn('text-[var(--site-accent,#fbbf24)]', dimensions.icon)}
        />
      )}
    </span>
  );
}
