'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Newspaper,
  Pencil,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import type {
  AdminWebsiteConfig,
  AdminWebsiteConfigResponse,
  DnsTargetsInfo,
  ModalidadeCulto,
  PublicChurchSchedule,
  PublicTenantNews,
} from '@/lib/api-website';
import {
  buildImageFormData,
  IMAGE_UPLOAD_ACCEPT,
  validateImageFile,
} from '@/lib/image-upload';
import { useAuthUser } from '@/contexts/auth-user-context';
import { PageHeader } from '@/components/app/page-header';
import { TabsShell } from '@/components/app/tabs-shell';
import { Skeleton } from '@/components/app/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { PrimaryActionButton } from '@/components/app/primary-action-button';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ImageUploadPanel } from '@/components/app/image-upload-panel';
import { InputField, TextareaField } from '@/components/app/form-field';
import {
  ScheduleFormModal,
  WEEKDAY_OPTIONS,
} from '@/components/app/site/schedule-form-modal';
import { NewsFormModal } from '@/components/app/site/news-form-modal';
import { DomainSetupCard } from '@/components/app/site/domain-setup-card';

type SiteCmsTab =
  | 'hero'
  | 'cultos'
  | 'noticias'
  | 'sobre'
  | 'contato'
  | 'dominio';

const RAW_HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i;

const MODALIDADE_BADGE: Record<ModalidadeCulto, { label: string; className: string }> = {
  PRESENCIAL: {
    label: 'Presencial',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  ONLINE: {
    label: 'Online',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  HIBRIDO: {
    label: 'Híbrido',
    className: 'bg-accent-soft text-accent-ink border-accent-soft-border',
  },
};

function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getWeekdayLabel(day: number): string {
  return WEEKDAY_OPTIONS.find((item) => item.value === day)?.label ?? `Dia ${day}`;
}

function formatDateBr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface ConfigFormState {
  tituloHero: string;
  subtituloHero: string;
  versiculoTema: string;
  versiculoReferencia: string;
  sobreNos: string;
  historia: string;
  visaoValores: string;
  pastoresNomes: string;
  pastoresBio: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  googleMapsUrl: string;
  horarioSecretaria: string;
  instagramUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  spotifyUrl: string;
  whatsappAtendimento: string;
}

const EMPTY_CONFIG_FORM: ConfigFormState = {
  tituloHero: '',
  subtituloHero: '',
  versiculoTema: '',
  versiculoReferencia: '',
  sobreNos: '',
  historia: '',
  visaoValores: '',
  pastoresNomes: '',
  pastoresBio: '',
  endereco: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  googleMapsUrl: '',
  horarioSecretaria: '',
  instagramUrl: '',
  youtubeUrl: '',
  facebookUrl: '',
  spotifyUrl: '',
  whatsappAtendimento: '',
};

export default function ConfiguracoesSitePage() {
  const { user } = useAuthUser();
  const [activeTab, setActiveTab] = useState<SiteCmsTab>('hero');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantNome, setTenantNome] = useState('');
  const [tenantPlano, setTenantPlano] = useState<'GRATUITO' | 'BASICO' | 'PROFISSIONAL'>('GRATUITO');
  const [canUseCustomDomain, setCanUseCustomDomain] = useState(false);
  const [dnsTargets, setDnsTargets] = useState<DnsTargetsInfo>({
    cnameTarget: 'cname.vercel-dns.com',
    apexIp: '76.76.21.21',
    vercelConfigured: false,
  });
  const [siteConfig, setSiteConfig] = useState<AdminWebsiteConfig | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [form, setForm] = useState<ConfigFormState>(EMPTY_CONFIG_FORM);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [pastoresFotoUrl, setPastoresFotoUrl] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerRemoving, setBannerRemoving] = useState(false);
  const [pastorsUploading, setPastorsUploading] = useState(false);
  const [pastorsRemoving, setPastorsRemoving] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const pastorsInputRef = useRef<HTMLInputElement | null>(null);

  const [schedules, setSchedules] = useState<PublicChurchSchedule[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PublicChurchSchedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<PublicChurchSchedule | null>(null);
  const [scheduleActionLoading, setScheduleActionLoading] = useState(false);
  const [reorderingSchedules, setReorderingSchedules] = useState(false);

  const [newsList, setNewsList] = useState<PublicTenantNews[]>([]);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<PublicTenantNews | null>(null);
  const [deletingNews, setDeletingNews] = useState<PublicTenantNews | null>(null);
  const [newsDeleteLoading, setNewsDeleteLoading] = useState(false);

  const revalidatePublicSite = useCallback(
    async (slugOverride?: string, noticiaSlug?: string) => {
      const slugToRevalidate = slugOverride || tenantSlug;
      if (!slugToRevalidate) return;
      try {
        await fetch('/api/site/revalidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slugToRevalidate, noticiaSlug }),
        });
      } catch {
        // Non-blocking revalidation best effort
      }
    },
    [tenantSlug],
  );

  useEffect(() => {
    if (user?.role === 'BASIC') {
      return;
    }

    let cancelled = false;

    Promise.all([
      api.get<AdminWebsiteConfigResponse>('/api/site/config'),
      api.get<PublicChurchSchedule[]>('/api/site/cultos'),
      api.get<PublicTenantNews[]>('/api/site/noticias'),
    ])
      .then(([configRes, schedulesRes, newsRes]) => {
        if (cancelled) return;
        setLoadError(null);
        setTenantSlug(configRes.tenant.slug);
        setTenantNome(configRes.tenant.nome);
        setTenantPlano(configRes.tenant.plano ?? 'GRATUITO');
        setCanUseCustomDomain(Boolean(configRes.canUseCustomDomain));
        if (configRes.dnsTargets) {
          setDnsTargets(configRes.dnsTargets);
        }
        setSiteConfig(configRes.config);
        setBannerUrl(configRes.config?.bannerUrl ?? null);
        setPastoresFotoUrl(configRes.config?.pastoresFotoUrl ?? null);
        setForm({
          tituloHero: configRes.config?.tituloHero ?? '',
          subtituloHero: configRes.config?.subtituloHero ?? '',
          versiculoTema: configRes.config?.versiculoTema ?? '',
          versiculoReferencia: configRes.config?.versiculoReferencia ?? '',
          sobreNos: configRes.config?.sobreNos ?? '',
          historia: configRes.config?.historia ?? '',
          visaoValores: configRes.config?.visaoValores ?? '',
          pastoresNomes: configRes.config?.pastoresNomes ?? '',
          pastoresBio: configRes.config?.pastoresBio ?? '',
          endereco: configRes.config?.endereco ?? '',
          numero: configRes.config?.numero ?? '',
          bairro: configRes.config?.bairro ?? '',
          cidade: configRes.config?.cidade ?? '',
          estado: configRes.config?.estado ?? '',
          cep: configRes.config?.cep ?? '',
          googleMapsUrl: configRes.config?.googleMapsUrl ?? '',
          horarioSecretaria: configRes.config?.horarioSecretaria ?? '',
          instagramUrl: configRes.config?.instagramUrl ?? '',
          youtubeUrl: configRes.config?.youtubeUrl ?? '',
          facebookUrl: configRes.config?.facebookUrl ?? '',
          spotifyUrl: configRes.config?.spotifyUrl ?? '',
          whatsappAtendimento: configRes.config?.whatsappAtendimento ?? '',
        });
        setSchedules(schedulesRes);
        setNewsList(newsRes);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof HttpError
            ? err.message
            : 'Não foi possível carregar as configurações do site.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  function setField<K extends keyof ConfigFormState>(key: K, value: ConfigFormState[K]) {
    setConfigFeedback(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function getPublicSiteUrl(): string {
    if (!tenantSlug) return '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://oneelo.vercel.app';
    return `${origin}/${tenantSlug}`;
  }

  async function handleCopySiteUrl() {
    const url = getPublicSiteUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Fallback noop
    }
  }

  async function handleSaveConfig(e?: React.FormEvent) {
    e?.preventDefault();
    setConfigFeedback(null);

    const urlFields: Array<[string, string]> = [
      ['Google Maps', form.googleMapsUrl],
      ['Instagram', form.instagramUrl],
      ['YouTube', form.youtubeUrl],
      ['Facebook', form.facebookUrl],
      ['Spotify', form.spotifyUrl],
    ];

    for (const [label, value] of urlFields) {
      if (!isValidHttpUrl(value)) {
        setConfigFeedback({
          type: 'error',
          message: `O link informado em ${label} deve começar com http:// ou https://.`,
        });
        return;
      }
    }

    const noHtmlFields = [form.sobreNos, form.historia, form.visaoValores, form.pastoresBio];
    if (noHtmlFields.some((text) => RAW_HTML_TAG_PATTERN.test(text))) {
      setConfigFeedback({
        type: 'error',
        message: 'Os textos institucionais não podem conter tags HTML.',
      });
      return;
    }

    try {
      setSavingConfig(true);
      await api.put('/api/site/config', {
        tituloHero: form.tituloHero.trim() || null,
        subtituloHero: form.subtituloHero.trim() || null,
        versiculoTema: form.versiculoTema.trim() || null,
        versiculoReferencia: form.versiculoReferencia.trim() || null,
        sobreNos: form.sobreNos.trim() || null,
        historia: form.historia.trim() || null,
        visaoValores: form.visaoValores.trim() || null,
        pastoresNomes: form.pastoresNomes.trim() || null,
        pastoresBio: form.pastoresBio.trim() || null,
        endereco: form.endereco.trim() || null,
        numero: form.numero.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim() || null,
        cep: form.cep.trim() || null,
        googleMapsUrl: form.googleMapsUrl.trim() || null,
        horarioSecretaria: form.horarioSecretaria.trim() || null,
        instagramUrl: form.instagramUrl.trim() || null,
        youtubeUrl: form.youtubeUrl.trim() || null,
        facebookUrl: form.facebookUrl.trim() || null,
        spotifyUrl: form.spotifyUrl.trim() || null,
        whatsappAtendimento: form.whatsappAtendimento.trim() || null,
      });

      await revalidatePublicSite();
      setConfigFeedback({
        type: 'success',
        message: 'Alterações salvas e publicadas no portal da igreja.',
      });
    } catch (err) {
      setConfigFeedback({
        type: 'error',
        message:
          err instanceof HttpError
            ? err.message
            : 'Erro ao salvar configurações do site.',
      });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleUploadConfigMedia(
    slot: 'banner' | 'pastors',
    file: File | undefined,
  ) {
    if (!file) return;
    setMediaError(null);

    const validationError = validateImageFile(file);
    if (validationError) {
      setMediaError(validationError);
      return;
    }

    const endpoint =
      slot === 'banner' ? '/api/site/banner' : '/api/site/pastores-foto';

    try {
      if (slot === 'banner') {
        setBannerUploading(true);
      } else {
        setPastorsUploading(true);
      }

      const updated = await api.post<{ bannerUrl?: string | null; pastoresFotoUrl?: string | null }>(
        endpoint,
        buildImageFormData(file),
      );

      if (slot === 'banner') {
        setBannerUrl(updated.bannerUrl ?? null);
        if (bannerInputRef.current) bannerInputRef.current.value = '';
      } else {
        setPastoresFotoUrl(updated.pastoresFotoUrl ?? null);
        if (pastorsInputRef.current) pastorsInputRef.current.value = '';
      }

      await revalidatePublicSite();
      setConfigFeedback({
        type: 'success',
        message:
          slot === 'banner'
            ? 'Banner principal atualizado com sucesso.'
            : 'Foto pastoral atualizada com sucesso.',
      });
    } catch (err) {
      setMediaError(
        err instanceof HttpError ? err.message : 'Erro ao enviar imagem.',
      );
    } finally {
      setBannerUploading(false);
      setPastorsUploading(false);
    }
  }

  async function handleRemoveConfigMedia(slot: 'banner' | 'pastors') {
    setMediaError(null);
    const endpoint =
      slot === 'banner' ? '/api/site/banner' : '/api/site/pastores-foto';

    try {
      if (slot === 'banner') {
        setBannerRemoving(true);
      } else {
        setPastorsRemoving(true);
      }

      await api.delete(endpoint);
      if (slot === 'banner') {
        setBannerUrl(null);
      } else {
        setPastoresFotoUrl(null);
      }

      await revalidatePublicSite();
      setConfigFeedback({
        type: 'success',
        message:
          slot === 'banner' ? 'Banner removido.' : 'Foto dos pastores removida.',
      });
    } catch (err) {
      setMediaError(
        err instanceof HttpError ? err.message : 'Erro ao remover imagem.',
      );
    } finally {
      setBannerRemoving(false);
      setPastorsRemoving(false);
    }
  }

  async function refreshSchedules() {
    const items = await api.get<PublicChurchSchedule[]>('/api/site/cultos');
    setSchedules(items);
    await revalidatePublicSite();
  }

  async function handleToggleScheduleActive(item: PublicChurchSchedule) {
    try {
      setScheduleActionLoading(true);
      await api.put(`/api/site/cultos/${item.id}`, { ativo: !item.ativo });
      await refreshSchedules();
    } catch (err) {
      setConfigFeedback({
        type: 'error',
        message:
          err instanceof HttpError
            ? err.message
            : 'Erro ao atualizar visibilidade do horário.',
      });
    } finally {
      setScheduleActionLoading(false);
    }
  }

  async function handleMoveSchedule(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schedules.length) return;

    const reordered = [...schedules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setSchedules(reordered);

    try {
      setReorderingSchedules(true);
      const updated = await api.patch<PublicChurchSchedule[]>(
        '/api/site/cultos/reordenar',
        { orderedIds: reordered.map((item) => item.id) },
      );
      setSchedules(updated);
      await revalidatePublicSite();
    } catch (err) {
      await refreshSchedules();
      setConfigFeedback({
        type: 'error',
        message:
          err instanceof HttpError
            ? err.message
            : 'Erro ao reordenar horários.',
      });
    } finally {
      setReorderingSchedules(false);
    }
  }

  async function handleConfirmDeleteSchedule() {
    if (!deletingSchedule) return;
    try {
      setScheduleActionLoading(true);
      await api.delete(`/api/site/cultos/${deletingSchedule.id}`);
      setDeletingSchedule(null);
      await refreshSchedules();
    } catch (err) {
      setConfigFeedback({
        type: 'error',
        message:
          err instanceof HttpError
            ? err.message
            : 'Erro ao excluir horário.',
      });
    } finally {
      setScheduleActionLoading(false);
    }
  }

  async function refreshNews(noticiaSlug?: string) {
    const items = await api.get<PublicTenantNews[]>('/api/site/noticias');
    setNewsList(items);
    await revalidatePublicSite(undefined, noticiaSlug);
  }

  async function handleConfirmDeleteNews() {
    if (!deletingNews) return;
    try {
      setNewsDeleteLoading(true);
      await api.delete(`/api/site/noticias/${deletingNews.id}`);
      const deletedSlug = deletingNews.slug;
      setDeletingNews(null);
      await refreshNews(deletedSlug);
    } catch (err) {
      setConfigFeedback({
        type: 'error',
        message:
          err instanceof HttpError
            ? err.message
            : 'Erro ao excluir informativo.',
      });
    } finally {
      setNewsDeleteLoading(false);
    }
  }

  if (user?.role === 'BASIC') {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Você não possui permissão para gerenciar o site institucional da igreja.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <PageHeader
          title="Site da Igreja"
          description="Portal institucional público da comunidade."
        />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {loadError}
        </div>
      </div>
    );
  }

  const publicSiteUrl = getPublicSiteUrl();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Site da Igreja"
        description={`Personalize a página pública de ${tenantNome || 'sua igreja'} em /${tenantSlug}.`}
        stackActionsOnMobile
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySiteUrl}
              disabled={!publicSiteUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-2xs transition hover:bg-gray-50 disabled:opacity-50"
            >
              {copiedUrl ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Link Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-gray-500" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>

            <a
              href={`/${tenantSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover"
            >
              <Globe className="h-4 w-4" />
              <span>Visualizar Site Público</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          </div>
        }
      />

      {configFeedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            configFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {configFeedback.message}
        </div>
      )}

      {mediaError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {mediaError}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        <TabsShell
          activeTab={activeTab}
          onTabChange={(id) => {
            setActiveTab(id as SiteCmsTab);
            setConfigFeedback(null);
            setMediaError(null);
          }}
          tabs={[
            { id: 'hero', label: 'Aparência & Hero' },
            { id: 'cultos', label: 'Cultos Regulares', badge: schedules.length },
            { id: 'noticias', label: 'Informativos', badge: newsList.length },
            { id: 'sobre', label: 'Sobre & Pastores' },
            { id: 'contato', label: 'Contato & Redes' },
            { id: 'dominio', label: 'Domínio Próprio' },
          ]}
        >
          {activeTab === 'hero' && (
            <form onSubmit={handleSaveConfig} className="space-y-6 p-6">
              <div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={(e) => handleUploadConfigMedia('banner', e.target.files?.[0])}
                />
                <ImageUploadPanel
                  title="Banner Principal (Hero)"
                  description="Imagem de destaque do topo da página. Recomenda-se proporção paisagem (16:9), até 5 MB."
                  imageUrl={bannerUrl}
                  fallbackName={tenantNome || 'Igreja'}
                  alt={`Banner de ${tenantNome}`}
                  previewClassName="h-20 w-36 rounded-xl"
                  uploading={bannerUploading}
                  removing={bannerRemoving}
                  removeDisabled={!bannerUrl}
                  onUploadClick={() => bannerInputRef.current?.click()}
                  onRemoveClick={() => handleRemoveConfigMedia('banner')}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  id="hero-title"
                  label="Título de Boas-Vindas"
                  optionalLabel="(opcional)"
                  placeholder={`Ex: Bem-vindo à ${tenantNome || 'Nossa Igreja'}`}
                  maxLength={140}
                  value={form.tituloHero}
                  onChange={(e) => setField('tituloHero', e.target.value)}
                />
                <InputField
                  id="hero-verse-ref"
                  label="Referência Bíblica"
                  optionalLabel="(opcional)"
                  placeholder="Ex: Salmos 23:1"
                  maxLength={80}
                  value={form.versiculoReferencia}
                  onChange={(e) => setField('versiculoReferencia', e.target.value)}
                />
              </div>

              <TextareaField
                id="hero-subtitle"
                label="Subtítulo de Acolhimento"
                optionalLabel="(opcional)"
                placeholder="Ex: Uma comunidade de fé, comunhão e serviço para toda a família."
                maxLength={280}
                rows={2}
                value={form.subtituloHero}
                onChange={(e) => setField('subtituloHero', e.target.value)}
              />

              <TextareaField
                id="hero-verse"
                label="Versículo Tema"
                optionalLabel="(opcional)"
                placeholder="Ex: O Senhor é o meu pastor; nada me faltará."
                maxLength={320}
                rows={2}
                value={form.versiculoTema}
                onChange={(e) => setField('versiculoTema', e.target.value)}
              />

              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-xs transition hover:bg-brand-hover disabled:opacity-60"
                >
                  {savingConfig ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{savingConfig ? 'Salvando...' : 'Salvar Aparência & Hero'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'cultos' && (
            <div className="space-y-5 p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Horários de Cultos e Reuniões
                  </h3>
                  <p className="text-xs text-gray-500">
                    Organize a ordem dos cultos semanais exibidos aos visitantes.
                  </p>
                </div>
                <PrimaryActionButton
                  label="Novo Horário"
                  onClick={() => {
                    setEditingSchedule(null);
                    setScheduleModalOpen(true);
                  }}
                />
              </div>

              {schedules.length === 0 ? (
                <EmptyState
                  title="Nenhum horário cadastrado"
                  description="Adicione os cultos semanais, estudos bíblicos ou reuniões de oração da igreja."
                  icon={<CalendarClock className="h-7 w-7" />}
                  action={
                    <PrimaryActionButton
                      label="Cadastrar Primeiro Horário"
                      onClick={() => {
                        setEditingSchedule(null);
                        setScheduleModalOpen(true);
                      }}
                    />
                  }
                />
              ) : (
                <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
                  {schedules.map((item, idx) => {
                    const mode = MODALIDADE_BADGE[item.modalidade];
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-ink">
                              {getWeekdayLabel(item.diaSemana)} · {item.horario}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${mode.className}`}
                            >
                              {mode.label}
                            </span>
                            {!item.ativo && (
                              <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                                Oculto
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-gray-900">{item.titulo}</h4>
                          {item.descricao && (
                            <p className="text-xs text-gray-500">{item.descricao}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            disabled={idx === 0 || reorderingSchedules}
                            onClick={() => handleMoveSchedule(idx, 'up')}
                            title="Mover para cima"
                            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === schedules.length - 1 || reorderingSchedules}
                            onClick={() => handleMoveSchedule(idx, 'down')}
                            title="Mover para baixo"
                            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={scheduleActionLoading}
                            onClick={() => handleToggleScheduleActive(item)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            {item.ativo ? 'Ocultar' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSchedule(item);
                              setScheduleModalOpen(true);
                            }}
                            title="Editar"
                            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingSchedule(item)}
                            title="Excluir"
                            className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'noticias' && (
            <div className="space-y-5 p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Informativos e Comunicados
                  </h3>
                  <p className="text-xs text-gray-500">
                    Compartilhe avisos, conferências, batismos e programações especiais.
                  </p>
                </div>
                <PrimaryActionButton
                  label="Novo Informativo"
                  onClick={() => {
                    setEditingNews(null);
                    setNewsModalOpen(true);
                  }}
                />
              </div>

              {newsList.length === 0 ? (
                <EmptyState
                  title="Nenhum informativo publicado"
                  description="Crie o primeiro aviso ou notícia para aparecer no portal institucional."
                  icon={<Newspaper className="h-7 w-7" />}
                  action={
                    <PrimaryActionButton
                      label="Publicar Primeiro Informativo"
                      onClick={() => {
                        setEditingNews(null);
                        setNewsModalOpen(true);
                      }}
                    />
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {newsList.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex gap-4">
                        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                          {item.imagemUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imagemUrl}
                              alt={item.titulo}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-300">
                              <Newspaper className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-gray-400">
                              {formatDateBr(item.dataPublicacao)}
                            </span>
                            {item.destaque && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                Destaque
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                item.ativo
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                              }`}
                            >
                              {item.ativo ? 'Publicado' : 'Rascunho'}
                            </span>
                          </div>
                          <h4 className="truncate text-sm font-bold text-gray-900">
                            {item.titulo}
                          </h4>
                          <p className="line-clamp-2 text-xs text-gray-500">
                            {item.resumo || item.conteudo}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <a
                          href={`/${tenantSlug}/noticias/${item.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:text-accent-ink-hover"
                        >
                          <span>Abrir página</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNews(item);
                              setNewsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingNews(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sobre' && (
            <form onSubmit={handleSaveConfig} className="space-y-6 p-6">
              <div>
                <input
                  ref={pastorsInputRef}
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={(e) => handleUploadConfigMedia('pastors', e.target.files?.[0])}
                />
                <ImageUploadPanel
                  title="Foto dos Pastores Presidentes"
                  description="Foto exibida na seção de liderança e história da igreja (até 5 MB)."
                  imageUrl={pastoresFotoUrl}
                  fallbackName={form.pastoresNomes || tenantNome || 'Pastores'}
                  alt={form.pastoresNomes || 'Pastores Presidentes'}
                  previewClassName="h-20 w-20 rounded-2xl"
                  uploading={pastorsUploading}
                  removing={pastorsRemoving}
                  removeDisabled={!pastoresFotoUrl}
                  onUploadClick={() => pastorsInputRef.current?.click()}
                  onRemoveClick={() => handleRemoveConfigMedia('pastors')}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <InputField
                  id="pastors-names"
                  label="Nomes dos Pastores / Liderança"
                  optionalLabel="(opcional)"
                  placeholder="Ex: Pr. Carlos Silva e Pra. Ana Silva"
                  maxLength={160}
                  value={form.pastoresNomes}
                  onChange={(e) => setField('pastoresNomes', e.target.value)}
                />

                <TextareaField
                  id="pastors-bio"
                  label="Apresentação Pastoral"
                  optionalLabel="(opcional)"
                  placeholder="Conte brevemente sobre o chamado e caminhada pastoral."
                  maxLength={2500}
                  rows={3}
                  value={form.pastoresBio}
                  onChange={(e) => setField('pastoresBio', e.target.value)}
                />

                <TextareaField
                  id="about-us"
                  label="Sobre Nós"
                  optionalLabel="(opcional)"
                  placeholder="Apresentação geral da identidade e acolhimento da igreja."
                  maxLength={2500}
                  rows={3}
                  value={form.sobreNos}
                  onChange={(e) => setField('sobreNos', e.target.value)}
                />

                <TextareaField
                  id="about-history"
                  label="Nossa História"
                  optionalLabel="(opcional)"
                  placeholder="Como a igreja começou e os principais marcos da caminhada."
                  maxLength={4000}
                  rows={4}
                  value={form.historia}
                  onChange={(e) => setField('historia', e.target.value)}
                />

                <TextareaField
                  id="about-vision"
                  label="Visão e Valores"
                  optionalLabel="(opcional)"
                  placeholder="Propósito, missão, visão e valores cristãos da comunidade."
                  maxLength={2500}
                  rows={3}
                  value={form.visaoValores}
                  onChange={(e) => setField('visaoValores', e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <Users className="h-3.5 w-3.5" />
                  Use texto estruturado em parágrafos (HTML bruto é bloqueado).
                </span>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-xs transition hover:bg-brand-hover disabled:opacity-60"
                >
                  {savingConfig ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{savingConfig ? 'Salvando...' : 'Salvar Sobre & Pastores'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'contato' && (
            <form onSubmit={handleSaveConfig} className="space-y-6 p-6">
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <MapPin className="h-4 w-4 text-accent-ink" />
                  Endereço e Atendimento
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <InputField
                      id="contact-street"
                      label="Logradouro"
                      optionalLabel="(opcional)"
                      placeholder="Ex: Av. Paulista"
                      maxLength={180}
                      value={form.endereco}
                      onChange={(e) => setField('endereco', e.target.value)}
                    />
                  </div>
                  <InputField
                    id="contact-number"
                    label="Número"
                    optionalLabel="(opcional)"
                    placeholder="Ex: 1200"
                    maxLength={20}
                    value={form.numero}
                    onChange={(e) => setField('numero', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <InputField
                    id="contact-neighborhood"
                    label="Bairro"
                    optionalLabel="(opcional)"
                    placeholder="Centro"
                    maxLength={100}
                    value={form.bairro}
                    onChange={(e) => setField('bairro', e.target.value)}
                  />
                  <InputField
                    id="contact-city"
                    label="Cidade"
                    optionalLabel="(opcional)"
                    placeholder="São Paulo"
                    maxLength={100}
                    value={form.cidade}
                    onChange={(e) => setField('cidade', e.target.value)}
                  />
                  <InputField
                    id="contact-state"
                    label="Estado (UF)"
                    optionalLabel="(opcional)"
                    placeholder="SP"
                    maxLength={40}
                    value={form.estado}
                    onChange={(e) => setField('estado', e.target.value)}
                  />
                  <InputField
                    id="contact-zip"
                    label="CEP"
                    optionalLabel="(opcional)"
                    placeholder="01310-100"
                    maxLength={20}
                    value={form.cep}
                    onChange={(e) => setField('cep', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <InputField
                    id="contact-office-hours"
                    label="Horário da Secretaria"
                    optionalLabel="(opcional)"
                    placeholder="Ex: Segunda a Sexta, 09h às 18h"
                    maxLength={160}
                    value={form.horarioSecretaria}
                    onChange={(e) => setField('horarioSecretaria', e.target.value)}
                  />
                  <InputField
                    id="contact-maps"
                    label="Link do Google Maps"
                    optionalLabel="(opcional)"
                    placeholder="https://maps.google.com/?q=..."
                    maxLength={500}
                    value={form.googleMapsUrl}
                    onChange={(e) => setField('googleMapsUrl', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t border-gray-100 pt-6">
                <h3 className="text-sm font-bold text-gray-900">
                  Canais e Redes Sociais
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <InputField
                    id="contact-whatsapp"
                    label="WhatsApp de Atendimento"
                    optionalLabel="(opcional)"
                    placeholder="Ex: 5511999998888"
                    maxLength={40}
                    value={form.whatsappAtendimento}
                    onChange={(e) => setField('whatsappAtendimento', e.target.value)}
                  />
                  <InputField
                    id="social-instagram"
                    label="Instagram"
                    optionalLabel="(opcional)"
                    placeholder="https://instagram.com/suaigreja"
                    maxLength={300}
                    value={form.instagramUrl}
                    onChange={(e) => setField('instagramUrl', e.target.value)}
                  />
                  <InputField
                    id="social-youtube"
                    label="YouTube"
                    optionalLabel="(opcional)"
                    placeholder="https://youtube.com/@suaigreja"
                    maxLength={300}
                    value={form.youtubeUrl}
                    onChange={(e) => setField('youtubeUrl', e.target.value)}
                  />
                  <InputField
                    id="social-facebook"
                    label="Facebook"
                    optionalLabel="(opcional)"
                    placeholder="https://facebook.com/suaigreja"
                    maxLength={300}
                    value={form.facebookUrl}
                    onChange={(e) => setField('facebookUrl', e.target.value)}
                  />
                  <InputField
                    id="social-spotify"
                    label="Spotify / Podcast"
                    optionalLabel="(opcional)"
                    placeholder="https://open.spotify.com/show/..."
                    maxLength={300}
                    value={form.spotifyUrl}
                    onChange={(e) => setField('spotifyUrl', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-xs transition hover:bg-brand-hover disabled:opacity-60"
                >
                  {savingConfig ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{savingConfig ? 'Salvando...' : 'Salvar Contato & Redes'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'dominio' && (
            <DomainSetupCard
              tenantSlug={tenantSlug}
              tenantPlano={tenantPlano}
              canUseCustomDomain={canUseCustomDomain}
              isAdmin={user?.role === 'ADMIN'}
              initialDomain={siteConfig?.customDomain ?? null}
              initialDnsStatus={siteConfig?.dnsStatus ?? 'PENDING'}
              initialDnsCheckedAt={siteConfig?.dnsCheckedAt ?? null}
              initialVerifiedAt={siteConfig?.customDomainVerifiedAt ?? null}
              dnsTargets={dnsTargets}
              onDomainChanged={async () => {
                const updated = await api.get<AdminWebsiteConfigResponse>('/api/site/config');
                setSiteConfig(updated.config);
                if (updated.dnsTargets) setDnsTargets(updated.dnsTargets);
                await revalidatePublicSite();
              }}
            />
          )}
        </TabsShell>
      </div>

      <ScheduleFormModal
        isOpen={scheduleModalOpen}
        schedule={editingSchedule}
        onClose={() => {
          setScheduleModalOpen(false);
          setEditingSchedule(null);
        }}
        onSaved={refreshSchedules}
      />

      <NewsFormModal
        isOpen={newsModalOpen}
        newsItem={editingNews}
        onClose={() => {
          setNewsModalOpen(false);
          setEditingNews(null);
        }}
        onSaved={(savedSlug) => refreshNews(savedSlug)}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingSchedule)}
        title="Excluir Horário de Culto"
        description={
          <>
            Tem certeza que deseja remover{' '}
            <strong>{deletingSchedule?.titulo}</strong> da programação pública?
          </>
        }
        confirmLabel="Excluir Horário"
        loading={scheduleActionLoading}
        onConfirm={handleConfirmDeleteSchedule}
        onCancel={() => setDeletingSchedule(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingNews)}
        title="Excluir Informativo"
        description={
          <>
            Tem certeza que deseja excluir o informativo{' '}
            <strong>{deletingNews?.titulo}</strong>? A imagem vinculada também será removida.
          </>
        }
        confirmLabel="Excluir Informativo"
        loading={newsDeleteLoading}
        onConfirm={handleConfirmDeleteNews}
        onCancel={() => setDeletingNews(null)}
      />
    </div>
  );
}
