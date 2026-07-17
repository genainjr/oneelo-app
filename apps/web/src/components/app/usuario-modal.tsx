"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, UserRound } from "lucide-react";
import { User, Role } from "@/types";
import { api } from "@/lib/api";
import { InputField, PasswordField, SelectField } from "./form-field";
import { InternationalPhoneInput } from "./international-phone-input";
import { MembroSearchCombobox, MembroOption } from "./membro-search-combobox";
import { ModalError, ModalShell } from "./modal-shell";
import { includesNormalizedText } from "@/lib/utils";

interface UsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Partial<User> & { senha?: string; memberId?: string | null },
  ) => Promise<void>;
  usuario?: User | null;
  currentUserId?: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "STAFF", label: "Colaborador" },
  { value: "BASIC", label: "Basico" },
];

export function UsuarioModal(props: UsuarioModalProps) {
  if (!props.isOpen) return null;

  return <UsuarioModalContent key={props.usuario?.id ?? "new"} {...props} />;
}

function UsuarioModalContent({
  isOpen,
  onClose,
  onSave,
  usuario,
  currentUserId,
}: UsuarioModalProps) {
  const [nome, setNome] = useState(usuario?.nome || "");
  const [email, setEmail] = useState(usuario?.email || "");
  const [telefoneLogin, setTelefoneLogin] = useState(usuario?.telefoneLogin || "");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<Role>(usuario?.role || "BASIC");
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);

  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(true);
  const [selectedMembro, setSelectedMembro] = useState<MembroOption | null>(
    usuario?.membro
      ? { id: usuario.membro.id, nome: usuario.membro.nome }
      : null,
  );
  const [membroSearch, setMembroSearch] = useState(usuario?.membro?.nome || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!usuario;

  useEffect(() => {
    let active = true;

    api
      .get<MembroOption[]>("/api/auth/members-available")
      .then((data) => {
        if (active) setMembros(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setMembros([]);
      })
      .finally(() => {
        if (active) setMembrosLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const membrosDisponiveis = (() => {
    const disponiveis = [...membros];
    if (
      usuario?.membro &&
      !disponiveis.find((m) => m.id === usuario.membro!.id)
    ) {
      disponiveis.unshift({ id: usuario.membro.id, nome: usuario.membro.nome });
    }
    if (!membroSearch.trim()) return disponiveis;
    return disponiveis.filter((m) =>
      includesNormalizedText(m.nome, membroSearch),
    );
  })();

  function selectMembro(m: MembroOption) {
    setSelectedMembro(m);
    setMembroSearch(m.nome);
    if (!nome.trim()) setNome(m.nome);
    if (!email.trim() && m.email) setEmail(m.email);
    if (!telefoneLogin.trim() && m.whatsapp) setTelefoneLogin(m.whatsapp);
  }

  function clearMembro() {
    setSelectedMembro(null);
    setMembroSearch("");
  }

  function handleMembroSearchChange(value: string) {
    setMembroSearch(value);
    setSelectedMembro(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setError("O nome e obrigatorio.");
      return;
    }
    if (!email.trim()) {
      setError("O e-mail e obrigatorio.");
      return;
    }
    if (senha && senha.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: Partial<User> & {
        senha?: string;
        memberId?: string | null;
      } = {
        nome: nome.trim(),
        email: email.trim(),
        role,
        ativo,
        memberId: selectedMembro
          ? selectedMembro.id
          : isEditing
            ? null
            : undefined,
      };
      payload.telefoneLogin = telefoneLogin.trim() || (isEditing ? null : undefined);
      if (senha) payload.senha = senha;

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar usuario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title={isEditing ? "Editar Usuario" : "Novo Usuario"}
      icon={<UserRound className="h-5 w-5" />}
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
            form="usuario-form"
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <form id="usuario-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <ModalError>{error}</ModalError>}

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
          <InputField
            id="u-nome"
            label="Nome completo"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Maria Souza"
          />

          <InputField
            id="u-email"
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@igreja.com"
          />

          <InternationalPhoneInput
            id="u-telefone-login"
            label="Telefone de login"
            optionalLabel="Opcional"
            countryLabel="País do telefone de login"
            value={telefoneLogin}
            onChange={setTelefoneLogin}
          />

          <PasswordField
            id="u-senha"
            label={
              isEditing
                ? "Nova senha (deixe em branco para manter)"
                : "Senha inicial (opcional)"
            }
            required={false}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={
              isEditing
                ? "********"
                : "Deixe em branco para gerar link de ativacao"
            }
            autoComplete="new-password"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              id="u-role"
              label="Perfil / Permissao"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="u-ativo"
              label="Status"
              value={ativo ? "true" : "false"}
              onChange={(e) => setAtivo(e.target.value === "true")}
              disabled={isEditing && usuario?.id === currentUserId}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </SelectField>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 leading-relaxed">
            <strong>Perfis:</strong> Administrador tem acesso total; Colaborador
            pode gerenciar membros e escalas; Basico tem acesso somente leitura.
            {!isEditing && (
              <span>
                {" "}
                Sem senha inicial, o usuario ficara pendente e recebera um link
                de ativacao.
              </span>
            )}
            <span>
              {" "}
              O telefone de login é uma credencial separada do WhatsApp do membro; selecione o país e informe o número local.
            </span>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
