'use client';

import { useState, useEffect } from 'react';
import { Membro, StatusMembro } from '@/types';

interface MembroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Membro>) => Promise<void>;
  membro?: Membro | null;
}

export function MembroModal({ isOpen, onClose, onSave, membro }: MembroModalProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [status, setStatus] = useState<StatusMembro>('ATIVO');
  const [observacoes, setObservacoes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (membro) {
      setNome(membro.nome || '');
      setEmail(membro.email || '');
      setWhatsapp(membro.whatsapp || '');
      setDataNascimento(
        membro.dataNascimento ? membro.dataNascimento.split('T')[0] : ''
      );
      setStatus(membro.status || 'ATIVO');
      setObservacoes(membro.observacoes || '');
    } else {
      setNome('');
      setEmail('');
      setWhatsapp('');
      setDataNascimento('');
      setStatus('ATIVO');
      setObservacoes('');
    }
    setError(null);
  }, [membro, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setError('O nome é obrigatório.');
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
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar membro.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {membro ? 'Editar Membro' : 'Novo Membro'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
                {error}
              </div>
            )}

            {/* Nome */}
            <div className="space-y-1.5">
              <label htmlFor="nome" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Nome completo *
              </label>
              <input
                id="nome"
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Email & WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="whatsapp" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: 11999999999"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Nasc. & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="dataNascimento" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Data de Nascimento
                </label>
                <input
                  id="dataNascimento"
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="status" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusMembro)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="VISITANTE">Visitante</option>
                  <option value="TRANSFERIDO">Transferido</option>
                </select>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label htmlFor="observacoes" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Observações / Histórico
              </label>
              <textarea
                id="observacoes"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Insira detalhes como ministérios de interesse, data de batismo, etc."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-150 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
