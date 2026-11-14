import Link from 'next/link';
import { Church, Home } from 'lucide-react';

export default function TenantSiteNotFound() {
  return (
    <div
      data-brand-theme="church"
      className="flex min-h-screen flex-col items-center justify-center bg-[#faf9f6] px-4 py-12 text-center"
    >
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-xs space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stat-brand-bg text-stat-brand-text">
          <Church className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-stone-950">
            Site da igreja não encontrado
          </h1>
          <p className="text-sm leading-relaxed text-stone-600">
            O endereço informado não corresponde a uma igreja ativa ou foi alterado pela administração.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-hover"
          >
            <Home className="h-4 w-4" />
            <span>Ir para o One Elo</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
