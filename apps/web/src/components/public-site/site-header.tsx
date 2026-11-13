'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { LogIn, Menu, UserPlus, X } from 'lucide-react';
import type { PublicSiteTenant } from '@/lib/api-website';
import { ChurchBrandMark } from './church-brand-mark';

interface SiteHeaderProps {
  tenant: PublicSiteTenant;
  hasSchedules: boolean;
  hasNews: boolean;
  hasAbout: boolean;
  hasLocation: boolean;
  basePath?: string;
  membersLoginHref?: string;
}

export function SiteHeader({
  tenant,
  basePath,
  membersLoginHref = '/login',
}: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuId = useId();

  const homeHref = basePath !== undefined ? basePath || '/' : `/${tenant.slug}`;
  const cadastroHref =
    basePath !== undefined ? `${basePath}/cadastro` : `/${tenant.slug}/cadastro`;

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/90 bg-zinc-950/92 text-zinc-100 backdrop-blur-md">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-amber-400 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-zinc-950 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          href={homeHref}
          className="group flex min-w-0 items-center gap-3 rounded-full pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          <ChurchBrandMark
            logoUrl={tenant.logoUrl}
            churchName={tenant.nome}
            size="sm"
            className="transition group-hover:border-amber-300 group-hover:ring-amber-400/30"
          />
          <span className="truncate text-[15px] font-bold tracking-tight text-white sm:text-base">
            {tenant.nome}
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-2.5 md:flex">
          <Link
            href={cadastroHref}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-amber-400/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <UserPlus className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span>Cadastre-se</span>
          </Link>

          <a
            href={membersLoginHref}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 shadow-sm transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Área de Membros</span>
          </a>
        </nav>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-controls={mobileMenuId}
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-100 transition hover:border-zinc-700 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 md:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          id={mobileMenuId}
          className="border-t border-zinc-800 bg-zinc-950/98 px-4 pb-5 pt-4 shadow-2xl backdrop-blur-md md:hidden"
        >
          <div className="grid grid-cols-1 gap-2.5">
            <Link
              href={cadastroHref}
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-amber-400/60"
            >
              <UserPlus className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span>Cadastre-se</span>
            </Link>
            <a
              href={membersLoginHref}
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span>Área de Membros</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
