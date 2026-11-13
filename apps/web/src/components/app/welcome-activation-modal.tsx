'use client';

import { useState } from 'react';
import { ModalShell } from '@/components/app/modal-shell';
import { buildActivationWelcomeMessage } from '@/lib/activation-message';
import { Check, Copy, MessageCircle, ExternalLink, Sparkles } from 'lucide-react';

interface WelcomeActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  membro: {
    nome: string;
    whatsapp?: string | null;
    email?: string | null;
  };
  user?: {
    nome: string;
    email: string;
    activationExpiresAt?: string | null;
  } | null;
  activationLink?: string | null;
  tenantName?: string;
  description?: string;
}

export function WelcomeActivationModal({
  isOpen,
  onClose,
  membro,
  user,
  activationLink,
  tenantName,
  description,
}: WelcomeActivationModalProps) {
  const [copied, setCopied] = useState(false);

  const welcomeMessage = activationLink && user
    ? buildActivationWelcomeMessage(user, activationLink, tenantName)
    : `Olá, ${membro.nome}! Seja muito bem-vindo(a) à ${tenantName?.trim() || 'nossa igreja'}. Estamos muito felizes em ter você conosco! 🙏`;

  const rawPhone = membro.whatsapp || '';
  const digits = rawPhone.replace(/\D/g, '');
  const hasExplicitCountryCode = rawPhone.trim().startsWith('+');
  const internationalPhone =
    hasExplicitCountryCode || digits.startsWith('55') ? digits : `55${digits}`;
  const waUrl = digits ? `https://wa.me/${internationalPhone}?text=${encodeURIComponent(welcomeMessage)}` : null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(welcomeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title="Cadastro Aprovado com Sucesso!"
      onClose={onClose}
      size="md"
    >
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-900">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-emerald-950 text-sm">
              {membro.nome} agora faz parte do sistema!
            </p>
            <p className="text-emerald-800 mt-0.5">
              {activationLink
                ? 'A conta de acesso foi gerada com token válido por 72 horas. Envie a mensagem de boas-vindas abaixo.'
                : description || 'O cadastro de visitante foi efetivado com sucesso.'}
            </p>
          </div>
        </div>

        {/* Prévia da mensagem */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Mensagem Oficial de Acolhimento
          </label>
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3.5 text-xs text-gray-800 font-sans whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
            {welcomeMessage}
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 active:scale-95 transition-all"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700">Copiada!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-gray-500" />
                <span>Copiar Mensagem</span>
              </>
            )}
          </button>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Enviar via WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Concluir
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
