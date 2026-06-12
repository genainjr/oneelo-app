'use client';

import { useState } from 'react';
import { Membro, StatusMembro } from '@/types';
import { InputField, SelectField, TextareaField } from './form-field';
import { ModalError, ModalShell } from './modal-shell';

interface MembroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Membro>) => Promise<void>;
  membro?: Membro | null;
}

export function MembroModal(props: MembroModalProps) {
  if (!props.isOpen) return null;

  return (
    <MembroModalContent
      key={props.membro?.id ?? 'new'}
      {...props}
    />
  );
}

function MembroModalContent({ isOpen, onClose, onSave, membro }: MembroModalProps) {
  const [nome, setNome] = useState(membro?.nome || '');
  const [email, setEmail] = useState(membro?.email || '');
  const [whatsapp, setWhatsapp] = useState(membro?.whatsapp || '');
  const [dataNascimento, setDataNascimento] = useState(
    membro?.dataNascimento ? membro.dataNascimento.split('T')[0] : '',
  );
  const [status, setStatus] = useState<StatusMembro>(membro?.status || 'ATIVO');
  const [observacoes, setObservacoes] = useState(membro?.observacoes || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setError('O nome e obrigatorio.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: Partial<Membro> = {
        nome: nome.trim(),
        email: email.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        dataNascimento: dataNascimento ? new Date(dataNascimento).toISOString() : undefined,
        status,
        observacoes: observacoes.trim() || undefined,
      };

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar membro.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title={membro ? 'Editar Membro' : 'Novo Membro'}
      onClose={onClose}
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
            form="membro-form"
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="membro-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <ModalError>{error}</ModalError>}

        <InputField
          id="nome"
          label="Nome completo"
          type="text"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Joao da Silva"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            id="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemplo@email.com"
          />

          <InputField
            id="whatsapp"
            label="WhatsApp"
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Ex: 11999999999"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            id="dataNascimento"
            label="Data de Nascimento"
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
          />

          <SelectField
            id="status"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusMembro)}
          >
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="VISITANTE">Visitante</option>
            <option value="TRANSFERIDO">Transferido</option>
          </SelectField>
        </div>

        <TextareaField
          id="observacoes"
          label="Observacoes / Historico"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Insira detalhes como ministerios de interesse, data de batismo, etc."
        />
      </form>
    </ModalShell>
  );
}
