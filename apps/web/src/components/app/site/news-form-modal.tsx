'use client';

import { useEffect, useRef, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import type { PublicTenantNews } from '@/lib/api-website';
import {
  buildImageFormData,
  IMAGE_UPLOAD_ACCEPT,
  validateImageFile,
} from '@/lib/image-upload';
import { ModalError, ModalFooter, ModalShell } from '@/components/app/modal-shell';
import {
  CheckboxField,
  InputField,
  TextareaField,
} from '@/components/app/form-field';
import { ImageUploadPanel } from '@/components/app/image-upload-panel';

const RAW_HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i;

function toDateInputValue(iso?: string | null): string {
  if (!iso) {
    return new Date().toISOString().slice(0, 10);
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

interface NewsFormModalProps {
  isOpen: boolean;
  newsItem: PublicTenantNews | null;
  onClose: () => void;
  onSaved: (savedSlug?: string) => Promise<void> | void;
}

export function NewsFormModal({
  isOpen,
  newsItem,
  onClose,
  onSaved,
}: NewsFormModalProps) {
  if (!isOpen) return null;

  return (
    <NewsFormModalContent
      key={newsItem?.id ?? 'new'}
      isOpen={isOpen}
      newsItem={newsItem}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function NewsFormModalContent({
  isOpen,
  newsItem,
  onClose,
  onSaved,
}: NewsFormModalProps) {
  const [titulo, setTitulo] = useState(newsItem?.titulo ?? '');
  const [resumo, setResumo] = useState(newsItem?.resumo ?? '');
  const [conteudo, setConteudo] = useState(newsItem?.conteudo ?? '');
  const [dataPublicacao, setDataPublicacao] = useState(
    toDateInputValue(newsItem?.dataPublicacao ?? null),
  );
  const [destaque, setDestaque] = useState(newsItem?.destaque ?? false);
  const [ativo, setAtivo] = useState(newsItem?.ativo ?? true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    newsItem?.imagemUrl ?? null,
  );
  const [removeImagePending, setRemoveImagePending] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  function handleImageSelected(file: File | undefined) {
    if (!file) return;
    setImageError(null);

    const validationError = validateImageFile(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }

    if (imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImagePending(false);
  }

  function handleRemoveImage() {
    setImageError(null);
    if (imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedFile(null);
    setImagePreview(null);
    setRemoveImagePending(Boolean(newsItem?.imagemUrl));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setImageError(null);

    if (!titulo.trim()) {
      setError('Informe o título do informativo.');
      return;
    }

    if (!conteudo.trim()) {
      setError('Informe o conteúdo completo do informativo.');
      return;
    }

    if (RAW_HTML_TAG_PATTERN.test(resumo) || RAW_HTML_TAG_PATTERN.test(conteudo)) {
      setError('Use apenas texto simples estruturado em parágrafos (tags HTML não são permitidas).');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        titulo: titulo.trim(),
        resumo: resumo.trim() || null,
        conteudo: conteudo.trim(),
        dataPublicacao: dataPublicacao
          ? new Date(`${dataPublicacao}T12:00:00.000Z`).toISOString()
          : undefined,
        destaque,
        ativo,
      };

      const saved = newsItem
        ? await api.put<PublicTenantNews>(`/api/site/noticias/${newsItem.id}`, payload)
        : await api.post<PublicTenantNews>('/api/site/noticias', payload);

      if (selectedFile && saved.id) {
        await api.post(
          `/api/site/noticias/${saved.id}/imagem`,
          buildImageFormData(selectedFile),
        );
      } else if (removeImagePending && newsItem?.id) {
        await api.delete(`/api/site/noticias/${newsItem.id}/imagem`);
      }

      await onSaved(saved.slug);
      onClose();
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : 'Não foi possível salvar o informativo.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title={newsItem ? 'Editar Informativo' : 'Novo Informativo'}
      description="Publique notícias, eventos e comunicados para membros e visitantes."
      icon={<Newspaper className="h-5 w-5" />}
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooter
          form="church-news-form"
          primaryLabel={newsItem ? 'Salvar Alterações' : 'Publicar Informativo'}
          onCancel={onClose}
          loading={loading}
        />
      }
    >
      <form id="church-news-form" onSubmit={handleSubmit}>
        <ModalError message={error} />
        <div className="space-y-4 p-6">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_UPLOAD_ACCEPT}
              className="hidden"
              onChange={(event) => handleImageSelected(event.target.files?.[0])}
            />
            <ImageUploadPanel
              title="Imagem de capa"
              description="Opcional. Use JPG, PNG ou WEBP até 5 MB."
              imageUrl={imagePreview}
              fallbackName={titulo || 'Info'}
              alt={titulo || 'Capa do informativo'}
              previewClassName="h-16 w-24 rounded-xl"
              uploading={loading && Boolean(selectedFile)}
              disabled={loading}
              removeDisabled={!imagePreview}
              onUploadClick={() => fileInputRef.current?.click()}
              onRemoveClick={handleRemoveImage}
            />
            {imageError && (
              <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {imageError}
              </p>
            )}
          </div>

          <InputField
            id="news-title"
            label="Título"
            required
            placeholder="Ex: Conferência de Famílias 2026"
            maxLength={160}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              id="news-date"
              label="Data de Publicação"
              type="date"
              value={dataPublicacao}
              onChange={(e) => setDataPublicacao(e.target.value)}
            />
            <div className="flex items-end pb-1">
              <span className="text-xs text-gray-500">
                O endereço amigável da notícia será gerado automaticamente pelo título.
              </span>
            </div>
          </div>

          <TextareaField
            id="news-summary"
            label="Resumo"
            optionalLabel="(opcional)"
            placeholder="Breve chamada exibida no card do site inicial."
            maxLength={320}
            rows={2}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
          />

          <TextareaField
            id="news-content"
            label="Conteúdo"
            required
            placeholder="Escreva os parágrafos do comunicado. Quebras de linha serão preservadas na leitura."
            maxLength={8000}
            rows={6}
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CheckboxField
              id="news-featured"
              label="Destacar no portal"
              helperText="Prioriza este informativo no topo da seção."
              checked={destaque}
              onChange={(e) => setDestaque(e.target.checked)}
            />
            <CheckboxField
              id="news-active"
              label="Publicado no site"
              helperText="Desmarque para manter salvo como rascunho."
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
