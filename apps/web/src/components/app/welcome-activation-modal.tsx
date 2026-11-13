'use client';

import { useState } from 'react';
import { ModalShell } from '@/components/app/modal-shell';
import { buildActivationWelcomeMessage } from '@/lib/activation-message';
import { Check, Copy, ExternalLink, Sparkles } from 'lucide-react';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5.016L2 22l5.156-1.359a9.92 9.92 0 0 0 4.875 1.281c5.516 0 9.969-4.453 9.969-9.969C22 6.453 17.547 2 12.031 2zm0 18.234a8.21 8.21 0 0 1-4.188-1.141l-.3-.172-3.062.812.812-2.984-.188-.312a8.243 8.243 0 0 1-1.266-4.406c0-4.547 3.703-8.25 8.25-8.25 2.203 0 4.266.859 5.828 2.422a8.21 8.21 0 0 1 2.406 5.828c0 4.547-3.703 8.203-8.292 8.203zm4.516-6.156c-.25-.125-1.469-.719-1.703-.812-.219-.078-.391-.125-.547.125-.172.25-.641.812-.781.984-.141.156-.297.188-.547.062-.25-.125-1.047-.391-2-1.234-.734-.656-1.234-1.469-1.375-1.719-.141-.25-.016-.375.109-.5.109-.109.25-.297.375-.438.125-.156.172-.25.25-.422.078-.172.047-.312-.016-.438-.062-.125-.547-1.328-.75-1.828-.203-.484-.406-.422-.547-.422h-.469c-.172 0-.438.062-.672.312-.234.25-.875.859-.875 2.094 0 1.234.906 2.438 1.031 2.609.125.156 1.766 2.703 4.297 3.797.594.25 1.062.406 1.422.516.609.188 1.156.172 1.594.109.484-.078 1.469-.609 1.672-1.188.203-.578.203-1.078.141-1.188-.047-.109-.219-.172-.469-.297z" />
    </svg>
  );
}

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
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3.5 text-xs text-gray-800 font-sans whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed max-h-56 overflow-y-auto">
            {welcomeMessage}
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap shadow-2xs hover:bg-gray-50 active:scale-95 transition-all"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700">Copiada!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-gray-500" />
                <span>Copiar</span>
              </>
            )}
          </button>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white whitespace-nowrap shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
            >
              <WhatsAppIcon className="h-4 w-4 shrink-0" />
              <span>WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-600 whitespace-nowrap hover:bg-gray-50 transition-all"
          >
            Concluir
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
