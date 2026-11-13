'use client';

import { useEffect, useRef, useState } from 'react';
import { Membro, StatusMembro } from '@/types';
import { InputField, SelectField, TextareaField } from './form-field';
import { ModalError, ModalShell } from './modal-shell';
import { ImageUploadPanel } from './image-upload-panel';
import { IMAGE_UPLOAD_ACCEPT, validateImageFile } from '@/lib/image-upload';

interface MembroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Membro>) => Promise<Membro | void>;
  onUploadPhoto?: (id: string, file: File) => Promise<Membro>;
  onRemovePhoto?: (id: string) => Promise<Membro>;
  onPromote?: (membro: Membro) => void;
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

function MembroModalContent({ isOpen, onClose, onSave, onUploadPhoto, onRemovePhoto, onPromote, membro }: MembroModalProps) {
  const [nome, setNome] = useState(membro?.nome || '');
  const [nomeExibicao, setNomeExibicao] = useState(membro?.nomeExibicao || '');
  const [email, setEmail] = useState(membro?.email || '');
  const [whatsapp, setWhatsapp] = useState(membro?.whatsapp || '');
  const [dataNascimento, setDataNascimento] = useState(
    membro?.dataNascimento ? membro.dataNascimento.split('T')[0] : '',
  );
  const [status, setStatus] = useState<StatusMembro>(membro?.status || 'ATIVO');
  const [matricula, setMatricula] = useState(membro?.matricula || '');
  const [cargo, setCargo] = useState(membro?.cargo || '');
  const [dataBatismo, setDataBatismo] = useState(
    membro?.dataBatismo ? membro.dataBatismo.split('T')[0] : '',
  );
  const [cpf, setCpf] = useState(membro?.cpf || '');
  const [rg, setRg] = useState(membro?.rg || '');
  const [sexo, setSexo] = useState(membro?.sexo || '');
  const [estadoCivil, setEstadoCivil] = useState(membro?.estadoCivil || '');
  const [observacoes, setObservacoes] = useState(membro?.observacoes || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoUrl = membro?.fotoUrl ?? null;
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [photoRemovalPending, setPhotoRemovalPending] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (selectedPhotoPreview) URL.revokeObjectURL(selectedPhotoPreview);
    };
  }, [selectedPhotoPreview]);

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
        nomeExibicao: nomeExibicao.trim() || undefined,
        email: email.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        dataNascimento: dataNascimento ? new Date(dataNascimento).toISOString() : undefined,
        status,
        matricula: matricula.trim() || undefined,
        cargo: cargo.trim() || undefined,
        dataBatismo: dataBatismo ? new Date(dataBatismo).toISOString() : undefined,
        cpf: cpf.trim() || undefined,
        rg: rg.trim() || undefined,
        sexo: (sexo || undefined) as any,
        estadoCivil: (estadoCivil || undefined) as any,
        observacoes: observacoes.trim() || undefined,
      };

      const saved = await onSave(payload);
      const memberId = saved?.id ?? membro?.id;

      if (selectedPhoto && memberId && onUploadPhoto) {
        setPhotoLoading(true);
        await onUploadPhoto(memberId, selectedPhoto);
      } else if (photoRemovalPending && memberId && onRemovePhoto) {
        setPhotoRemoving(true);
        await onRemovePhoto(memberId);
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar membro.');
    } finally {
      setPhotoLoading(false);
      setPhotoRemoving(false);
      setLoading(false);
    }
  }

  function openPhotoPicker() {
    photoInputRef.current?.click();
  }

  function handlePhotoSelected(file: File | undefined) {
    if (!file) return;

    setPhotoError(null);

    const validationError = validateImageFile(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }

    if (selectedPhotoPreview) URL.revokeObjectURL(selectedPhotoPreview);
    setSelectedPhoto(file);
    setSelectedPhotoPreview(URL.createObjectURL(file));
    setPhotoRemovalPending(false);
  }

  function handleRemovePhoto() {
    setPhotoError(null);
    if (selectedPhotoPreview) URL.revokeObjectURL(selectedPhotoPreview);
    setSelectedPhoto(null);
    setSelectedPhotoPreview(null);
    setPhotoRemovalPending(Boolean(membro?.fotoUrl));
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title={membro ? 'Editar Membro' : 'Novo Membro'}
      onClose={onClose}
      height="viewport"
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
        {membro?.status === 'VISITANTE' && onPromote && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950">
            <div>
              <p className="font-semibold">Cadastro atual: Visitante</p>
              <p className="text-emerald-800 mt-0.5">
                Promova para Membro Ativo validando a cota do plano e gerando o acesso ao aplicativo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPromote(membro)}
              disabled={loading}
              className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-all disabled:opacity-60"
            >
              Promover a Membro
            </button>
          </div>
        )}
        <section>
          <input
            ref={photoInputRef}
            type="file"
            accept={IMAGE_UPLOAD_ACCEPT}
            className="hidden"
            onChange={(event) => handlePhotoSelected(event.target.files?.[0])}
          />
          <ImageUploadPanel
            title="Foto do membro"
            description={membro ? 'Imagem usada no cadastro, perfil e visualizacoes.' : 'A foto sera enviada depois que o cadastro for salvo.'}
            imageUrl={selectedPhotoPreview ?? (photoRemovalPending ? null : photoUrl)}
            fallbackName={nome || membro?.nome || 'Membro'}
            alt={nome || membro?.nome || 'Membro'}
            uploading={photoLoading}
            removing={photoRemoving}
            disabled={loading}
            removeDisabled={!selectedPhoto && (!photoUrl || photoRemovalPending)}
            onUploadClick={openPhotoPicker}
            onRemoveClick={() => {
              handleRemovePhoto();
            }}
          />
          {photoError && (
            <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {photoError}
            </p>
          )}
        </section>

        <InputField
          id="nome"
          label="Nome completo"
          type="text"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Joao da Silva"
        />

        <InputField
          id="nomeExibicao"
          label="Nome de impressao"
          type="text"
          value={nomeExibicao}
          onChange={(e) => setNomeExibicao(e.target.value)}
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

        <div className="pt-2 border-t border-gray-100">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Dados Eclesiásticos e Carteirinha
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <InputField
              id="matricula"
              label="Matrícula / Rol de Membro"
              type="text"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              placeholder="Ex: ROL-00123"
            />

            <InputField
              id="cargo"
              label="Cargo / Função Eclesiástica"
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex: Pastor, Diácono, Membro"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <InputField
              id="dataBatismo"
              label="Data de Batismo"
              type="date"
              value={dataBatismo}
              onChange={(e) => setDataBatismo(e.target.value)}
            />

            <SelectField
              id="sexo"
              label="Sexo"
              value={sexo}
              onChange={(e) => setSexo(e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMININO">Feminino</option>
            </SelectField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <InputField
              id="cpf"
              label="CPF"
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
            />

            <InputField
              id="rg"
              label="RG"
              type="text"
              value={rg}
              onChange={(e) => setRg(e.target.value)}
              placeholder="Ex: 1234567-SSP"
            />

            <SelectField
              id="estadoCivil"
              label="Estado Civil"
              value={estadoCivil}
              onChange={(e) => setEstadoCivil(e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="SOLTEIRO">Solteiro(a)</option>
              <option value="CASADO">Casado(a)</option>
              <option value="UNIAO_ESTAVEL">União Estável</option>
              <option value="DIVORCIADO">Divorciado(a)</option>
              <option value="VIUVO">Viúvo(a)</option>
            </SelectField>
          </div>
        </div>

        <TextareaField
          id="observacoes"
          label="Observações / Histórico"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Insira detalhes adicionais sobre o membro..."
        />
      </form>
    </ModalShell>
  );
}
