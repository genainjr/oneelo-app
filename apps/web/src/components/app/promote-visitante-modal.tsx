'use client';

import { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { Membro } from '@/types';
import { InputField } from './form-field';
import { ModalError, ModalShell } from './modal-shell';
import { StatusBadge } from './status-badge';
import { STATUS_MEMBRO_COLOR, STATUS_MEMBRO_LABEL } from '@/lib/utils';

interface PromoteVisitanteModalProps {
  isOpen: boolean;
  membro: Membro | null;
  onClose: () => void;
  onPromote: (
    id: string,
    data: { email?: string; whatsapp?: string; criarAcesso: boolean },
  ) => Promise<void>;
}

export function PromoteVisitanteModal(props: PromoteVisitanteModalProps) {
  if (!props.isOpen || !props.membro) return null;

  return (
    <PromoteVisitanteModalContent
      key={props.membro.id}
      membro={props.membro}
      onClose={props.onClose}
      onPromote={props.onPromote}
    />
  );
}

function PromoteVisitanteModalContent({
  membro,
  onClose,
  onPromote,
}: {
  membro: Membro;
  onClose: () => void;
  onPromote: PromoteVisitanteModalProps['onPromote'];
}) {
  const [email, setEmail] = useState(membro.email || '');
  const [whatsapp, setWhatsapp] = useState(membro.whatsapp || '');
  const [criarAcesso, setCriarAcesso] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedWhatsapp = whatsapp.trim();

    if (criarAcesso && !trimmedEmail) {
      setError('Informe um e-mail válido para gerar o acesso do membro ao aplicativo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onPromote(membro.id, {
        email: trimmedEmail || undefined,
        whatsapp: trimmedWhatsapp || undefined,
        criarAcesso,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível promover o visitante.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      isOpen
      title="Promover Visitante a Membro"
      description="Confirme os dados de contato para efetivar como Membro Ativo."
      icon={<UserCheck className="h-5 w-5" />}
      onClose={onClose}
      size="md"
      bodyClassName="p-6"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-150 rounded-xl transition-all disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="promote-visitante-form"
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60"
          >
            {loading ? 'Promovendo...' : 'Promover a Membro'}
          </button>
        </>
      }
    >
      <form id="promote-visitante-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <ModalError>{error}</ModalError>}

        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{membro.nome}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              O status será alterado de Visitante para Membro Ativo.
            </p>
          </div>
          <StatusBadge
            label={STATUS_MEMBRO_LABEL[membro.status]}
            className={`shrink-0 font-bold ${STATUS_MEMBRO_COLOR[membro.status]}`}
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={criarAcesso}
            onChange={(e) => setCriarAcesso(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-xs text-gray-700 leading-relaxed">
            <span className="block font-semibold text-gray-900">
              Gerar acesso ao aplicativo e link de ativação
            </span>
            Cria o usuário com perfil Básico pendente e gera a mensagem de boas-vindas com link de ativação.
          </span>
        </label>

        <InputField
          id="promote-email"
          label={criarAcesso ? 'E-mail (obrigatório para acesso)' : 'E-mail (opcional)'}
          type="email"
          required={criarAcesso}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="exemplo@email.com"
        />

        <InputField
          id="promote-whatsapp"
          label="WhatsApp"
          type="text"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="Ex: +5585999999999"
        />
      </form>
    </ModalShell>
  );
}
