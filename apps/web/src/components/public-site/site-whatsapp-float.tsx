'use client';

import { useEffect, useRef, useState } from 'react';
import { WhatsAppIcon } from './church-brand-mark';

/**
 * Botão flutuante de conversa no WhatsApp alinhado à estética obsidian + âmbar do portal.
 * Usa sentinela com IntersectionObserver para surgir apenas após o usuário rolar além do Hero,
 * evitando cobrir os atalhos circulares do Hero no primeiro carregamento mobile.
 */
export function SiteWhatsappFloat({
  href,
  churchName,
}: {
  href: string | null;
  churchName: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      const sentinelTop = sentinelRef.current?.getBoundingClientRect().top;
      const pastHero =
        sentinelTop !== undefined ? sentinelTop <= 0 : window.scrollY > 260;

      const footerEl =
        document.querySelector('[data-site-footer="true"]') ||
        Array.from(document.querySelectorAll('footer')).at(-1);
      const footerTop = footerEl?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const footerVisible = footerTop < window.innerHeight - 16;

      setVisible(pastHero && !footerVisible);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, []);

  if (!href) return null;

  return (
    <>
      <div
        ref={sentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-[260px] h-1 w-1 opacity-0"
      />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Iniciar conversa no WhatsApp com ${churchName}`}
        className={`fixed bottom-5 right-5 z-30 inline-flex min-h-12 items-center gap-2.5 rounded-full border border-zinc-700/90 bg-zinc-950/92 py-1.5 pl-1.5 pr-4 text-xs font-bold text-white shadow-2xl shadow-black/50 backdrop-blur-md transition duration-200 hover:border-amber-400/60 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
          visible
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-zinc-950 shadow-sm">
          <WhatsAppIcon className="h-4 w-4" />
        </span>
        <span>WhatsApp</span>
      </a>
    </>
  );
}
