'use client';

import { useState, useRef, useEffect } from 'react';
import { ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { ModalShell } from './modal-shell';
import { InputField, SelectField } from './form-field';
import { ImageUploadPanel } from './image-upload-panel';
import { api } from '@/lib/api';
import { buildImageFormData, validateImageFile } from '@/lib/image-upload';
import { useAuthUser } from '@/contexts/auth-user-context';
import type { AuthUser, Membro, EstadoCivil, SexoMembro } from '@/types';

export interface CompletarCadastroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (membro?: any) => void;
  title?: string;
  description?: string;
}

export function isCadastroIncompleto(
  membro?: Partial<Membro> | AuthUser['membro'] | null,
): boolean {
  if (!membro) return false;
  const hasCpf = Boolean(membro.cpf && membro.cpf.trim().length >= 11);
  const hasNascimento = Boolean(membro.dataNascimento);
  const hasEstadoCivil = Boolean(membro.estadoCivil);
  return !hasCpf || !hasNascimento || !hasEstadoCivil;
}

export function CompletarCadastroModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Atualização Cadastral de Membro',
  description = 'Preencha os dados abaixo para liberar e emitir a sua Carteira de Membro Oficial.',
}: CompletarCadastroModalProps) {
  const { user, refreshUser, setUser: setLayoutUser } = useAuthUser();
  const membro = user?.membro;

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [nomeExibicao, setNomeExibicao] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [dataBatismo, setDataBatismo] = useState('');
  const [estadoCivil, setEstadoCivil] = useState<string>('');
  const [sexo, setSexo] = useState<string>('');

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [photoRemovalPending, setPhotoRemovalPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Inicializa o formulário com os dados existentes do membro/usuário
  useEffect(() => {
    if (membro || user) {
      setNome(user?.nome || membro?.nome || '');
      setEmail(user?.email || membro?.email || '');
      setNomeExibicao(membro?.nomeExibicao || '');
      setWhatsapp(membro?.whatsapp || '');
      setCpf(membro?.cpf || '');
      setRg(membro?.rg || '');
      setDataNascimento(membro?.dataNascimento ? membro.dataNascimento.split('T')[0] : '');
      setDataBatismo(membro?.dataBatismo ? membro.dataBatismo.split('T')[0] : '');
      setEstadoCivil(membro?.estadoCivil || '');
      setSexo(membro?.sexo || '');
      setSelectedPhoto(null);
      setSelectedPhotoPreview(null);
      setPhotoRemovalPending(false);
      setError(null);
    }
  }, [membro, user, isOpen]);

  // Formatação automática de CPF (000.000.000-00)
  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    if (val.length > 9) {
      val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}-${val.slice(9)}`;
    } else if (val.length > 6) {
      val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6)}`;
    } else if (val.length > 3) {
      val = `${val.slice(0, 3)}.${val.slice(3)}`;
    }
    setCpf(val);
  }

  function handlePhotoSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSelectedPhoto(file);
    setSelectedPhotoPreview(URL.createObjectURL(file));
    setPhotoRemovalPending(false);
  }

  function handlePhotoRemoved() {
    setSelectedPhoto(null);
    if (selectedPhotoPreview) {
      URL.revokeObjectURL(selectedPhotoPreview);
      setSelectedPhotoPreview(null);
    }
    setPhotoRemovalPending(true);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!membro) return;

    if (!nome.trim()) {
      setError('O Nome Completo é obrigatório.');
      return;
    }

    if (!email.trim()) {
      setError('O E-mail é obrigatório.');
      return;
    }

    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length > 0 && rawCpf.length !== 11) {
      setError('CPF inválido. Certifique-se de digitar os 11 dígitos.');
      return;
    }

    if (!rawCpf) {
      setError('O CPF é obrigatório para emissão da carteira de membro oficial.');
      return;
    }

    if (!dataNascimento) {
      setError('A Data de Nascimento é obrigatória.');
      return;
    }

    if (!estadoCivil) {
      setError('Selecione o Estado Civil.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Salva foto caso tenha sido selecionada ou removida
      let updatedMembroPhoto = membro.fotoUrl;
      if (selectedPhoto) {
        const photoRes = await api.post<Membro>('/api/auth/me/photo', buildImageFormData(selectedPhoto));
        if (photoRes?.fotoUrl) updatedMembroPhoto = photoRes.fotoUrl;
      } else if (photoRemovalPending && membro.fotoUrl) {
        await api.delete('/api/auth/me/photo');
        updatedMembroPhoto = null;
      }

      // 2. Salva os campos cadastrais
      const payload = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        nomeExibicao: nomeExibicao.trim() || null,
        whatsapp: whatsapp.trim() || null,
        cpf: rawCpf.length === 11 ? cpf.trim() : null,
        rg: rg.trim() || null,
        dataNascimento: dataNascimento ? new Date(dataNascimento).toISOString() : null,
        dataBatismo: dataBatismo ? new Date(dataBatismo).toISOString() : null,
        estadoCivil: (estadoCivil || null) as EstadoCivil | null,
        sexo: (sexo || null) as SexoMembro | null,
      };

      const updatedUser = await api.patch<AuthUser>('/api/auth/me/profile', payload);

      // 3. Atualiza estado global
      const freshUser = await refreshUser();
      const finalMember = freshUser?.membro || {
        ...membro,
        ...payload,
        fotoUrl: updatedMembroPhoto,
      } as Membro;

      if (updatedUser) {
        setLayoutUser(freshUser || updatedUser);
      }

      onClose();
      if (onSuccess) {
        onSuccess(finalMember);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar dados cadastrais.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      icon={<ShieldCheck className="h-5 w-5" />}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="completar-cadastro-form"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-brand-foreground bg-brand hover:bg-brand-hover transition-colors shadow-xs disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            <span>{loading ? 'Salvando...' : 'Salvar e Continuar'}</span>
          </button>
        </div>
      }
    >
      <form id="completar-cadastro-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload de Foto (Selfie ou Foto Oficial) */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
          />
          <ImageUploadPanel
            title="Foto do membro"
            description="Envie uma foto recente com fundo neutro para a carteirinha oficial."
            imageUrl={selectedPhotoPreview ?? (photoRemovalPending ? null : (membro?.fotoUrl || null))}
            fallbackName={membro?.nome || user?.nome || 'Membro'}
            alt={membro?.nome || user?.nome || 'Membro'}
            uploading={loading}
            disabled={loading}
            removeDisabled={!selectedPhoto && (!membro?.fotoUrl || photoRemovalPending)}
            onUploadClick={() => photoInputRef.current?.click()}
            onRemoveClick={handlePhotoRemoved}
          />
        </div>

        {/* Dados Pessoais e Cadastrais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            id="modal-nome"
            label="Nome Completo *"
            placeholder="Nome completo do membro"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoComplete="name"
          />

          <InputField
            id="modal-email"
            label="E-mail *"
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <InputField
            id="modal-nome-exibicao"
            label="Nome de Impressão"
            optionalLabel="O que sai na carteirinha"
            placeholder="Ex: Pr. João, João Silva..."
            value={nomeExibicao}
            onChange={(e) => setNomeExibicao(e.target.value)}
          />

          <InputField
            id="modal-whatsapp"
            label="Telefone / WhatsApp"
            optionalLabel="Opcional"
            placeholder="(00) 00000-0000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            autoComplete="tel"
          />

          <InputField
            id="modal-cpf"
            label="CPF *"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={handleCpfChange}
            required
            maxLength={14}
          />

          <InputField
            id="modal-rg"
            label="RG"
            placeholder="Número do documento"
            value={rg}
            onChange={(e) => setRg(e.target.value)}
          />

          <InputField
            id="modal-data-nasc"
            label="Data de Nascimento *"
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            required
          />

          <InputField
            id="modal-data-batismo"
            label="Data de Batismo"
            type="date"
            value={dataBatismo}
            onChange={(e) => setDataBatismo(e.target.value)}
          />

          <SelectField
            id="modal-estado-civil"
            label="Estado Civil *"
            value={estadoCivil}
            onChange={(e) => setEstadoCivil(e.target.value)}
            required
          >
            <option value="">Selecione o estado civil...</option>
            <option value="SOLTEIRO">Solteiro(a)</option>
            <option value="CASADO">Casado(a)</option>
            <option value="DIVORCIADO">Divorciado(a)</option>
            <option value="VIUVO">Viúvo(a)</option>
            <option value="UNIAO_ESTAVEL">União Estável</option>
          </SelectField>

          <SelectField
            id="modal-sexo"
            label="Sexo *"
            value={sexo}
            onChange={(e) => setSexo(e.target.value)}
            required
          >
            <option value="">Selecione o sexo...</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMININO">Feminino</option>
          </SelectField>
        </div>
      </form>
    </ModalShell>
  );
}
