'use client';

import { useState, useEffect } from 'react';
import { User, Role } from '@/types';
import { api } from '@/lib/api';
import { MembroSearchCombobox, MembroOption } from '@/components/app/membro-search-combobox';

interface UsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<User> & { senha?: string; memberId?: string | null }) => Promise<void>;
  usuario?: User | null;
  currentUserId?: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'STAFF', label: 'Colaborador' },
  { value: 'BASIC', label: 'Básico' },
];

export function UsuarioModal({
  isOpen,
  onClose,
  onSave,
  usuario,
  currentUserId,
}: UsuarioModalProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<Role>('BASIC');
  const [ativo, setAtivo] = useState(true);
  const [showSenha, setShowSenha] = useState(false);

  // Member linking
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(false);
  const [selectedMembro, setSelectedMembro] = useState<MembroOption | null>(null);
  const [membroSearch, setMembroSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!usuario;

  // Carregar membros disponíveis quando o modal abre
  useEffect(() => {
    if (!isOpen) return;
    setMembrosLoading(true);
    api.get<MembroOption[]>('/api/auth/members-available')
      .then((data) => setMembros(Array.isArray(data) ? data : []))
      .catch(() => setMembros([]))
      .finally(() => setMembrosLoading(false));
  }, [isOpen]);

  // Preencher campos ao editar
  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome || '');
      setEmail(usuario.email || '');
      setSenha('');
      setRole(usuario.role || 'BASIC');
      setAtivo(usuario.ativo ?? true);
      // Se já tem membro vinculado, pré-selecionar
      if (usuario.membro) {
        setSelectedMembro({ id: usuario.membro.id, nome: usuario.membro.nome });
        setMembroSearch(usuario.membro.nome);
      } else {
        setSelectedMembro(null);
        setMembroSearch('');
      }
    } else {
      setNome('');
      setEmail('');
      setSenha('');
      setRole('BASIC');
      setAtivo(true);
      setSelectedMembro(null);
      setMembroSearch('');
    }
    setError(null);
    setShowSenha(false);
  }, [usuario, isOpen]);

  if (!isOpen) return null;

  // Filtrar membros pelo texto digitado (inclui o atual se estiver editando)
  const membrosDisponiveis = (() => {
    const disponíveis = [...membros];
    // ao editar, adicionar o membro já vinculado se não estiver na lista (pois não é "available")
    if (usuario?.membro && !disponíveis.find((m) => m.id === usuario.membro!.id)) {
      disponíveis.unshift({ id: usuario.membro.id, nome: usuario.membro.nome });
    }
    if (!membroSearch.trim()) return disponíveis;
    return disponíveis.filter((m) =>
      m.nome.toLowerCase().includes(membroSearch.toLowerCase())
    );
  })();

  function selectMembro(m: MembroOption) {
    setSelectedMembro(m);
    setMembroSearch(m.nome);
    // Se o nome do usuário estiver vazio, preencher automaticamente
    if (!nome.trim()) setNome(m.nome);
    if (!email.trim() && m.email) setEmail(m.email);
  }

  function clearMembro() {
    setSelectedMembro(null);
    setMembroSearch('');
  }

  function handleMembroSearchChange(value: string) {
    setMembroSearch(value);
    setSelectedMembro(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setError('O nome é obrigatório.'); return; }
    if (!email.trim()) { setError('O e-mail é obrigatório.'); return; }
    if (!isEditing && !senha.trim()) { setError('A senha é obrigatória para novos usuários.'); return; }
    if (senha && senha.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }

    setLoading(true);
    setError(null);

    try {
      const payload: Partial<User> & { senha?: string; memberId?: string | null } = {
        nome: nome.trim(),
        email: email.trim(),
        role,
        ativo,
        // undefined = não alterar; null = desvincular; string = vincular
        memberId: selectedMembro ? selectedMembro.id : (isEditing ? null : undefined),
      };
      if (senha) payload.senha = senha;

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar usuário.');
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
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-800">
              {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <MembroSearchCombobox
              label="Vincular a um membro"
              optionalLabel="(opcional)"
              placeholder="Buscar membro pelo nome..."
              loading={membrosLoading}
              options={membrosDisponiveis}
              selected={selectedMembro}
              search={membroSearch}
              emptyMessage="Nenhum membro disponivel encontrado."
              selectedPrefix="Vinculado a"
              onSearchChange={handleMembroSearchChange}
              onSelect={selectMembro}
              onClear={clearMembro}
            />

            <div className="border-t border-gray-100 pt-4 space-y-4">
              {/* Nome */}
              <div className="space-y-1.5">
                <label htmlFor="u-nome" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nome completo *
                </label>
                <input
                  id="u-nome"
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Maria Souza"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <label htmlFor="u-email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  E-mail *
                </label>
                <input
                  id="u-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria@igreja.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <label htmlFor="u-senha" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {isEditing ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
                </label>
                <div className="relative">
                  <input
                    id="u-senha"
                    type={showSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder={isEditing ? '••••••••' : 'Mínimo 6 caracteres'}
                    className="w-full px-4 py-2.5 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showSenha ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Role & Ativo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="u-role" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Perfil / Permissão
                  </label>
                  <select
                    id="u-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="u-ativo" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </label>
                  <select
                    id="u-ativo"
                    value={ativo ? 'true' : 'false'}
                    onChange={(e) => setAtivo(e.target.value === 'true')}
                    disabled={isEditing && usuario?.id === currentUserId}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all disabled:opacity-50"
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              {/* Info box */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 leading-relaxed">
                <strong>Perfis:</strong> Administrador tem acesso total; Colaborador pode gerenciar membros e escalas; Básico tem acesso somente leitura.
              </div>
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
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

