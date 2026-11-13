'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { InputField, SelectField, TextareaField } from '@/components/app/form-field';
import { InternationalPhoneInput } from '@/components/app/international-phone-input';
import { ChurchBrandMark } from '@/components/public-site/church-brand-mark';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Heart,
  Loader2,
  Send,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { PublicTenantInfo } from './tenant-public';

interface PublicJoinClientProps {
  slug: string;
  initialTenant?: PublicTenantInfo | null;
  homeHref?: string;
}

const SITE_INPUT_CLASS =
  'border-stone-200 bg-stone-50 text-zinc-950 focus:border-amber-500 focus:bg-white';

export function PublicJoinClient({
  slug,
  initialTenant = null,
  homeHref,
}: PublicJoinClientProps) {
  const siteHomeHref = homeHref ?? `/${slug}`;
  const memberLoginHref = `/login?igreja=${encodeURIComponent(slug)}`;
  const [loadingTenant, setLoadingTenant] = useState(!initialTenant);
  const [tenant, setTenant] = useState<PublicTenantInfo | null>(initialTenant);
  const [tenantError, setTenantError] = useState<string | null>(null);

  const [tab, setTab] = useState<'VISITANTE' | 'MEMBRO'>('VISITANTE');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [sexo, setSexo] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [batizadoAguas, setBatizadoAguas] = useState<'true' | 'false' | ''>('');
  const [igrejaAnterior, setIgrejaAnterior] = useState('');
  const [quemConvidou, setQuemConvidou] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [consentimentoLgpd, setConsentimentoLgpd] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  // Carregar dados públicos do tenant no client apenas se não vieram no SSR
  useEffect(() => {
    if (initialTenant) {
      return;
    }

    async function loadTenant() {
      try {
        setLoadingTenant(true);
        const data = await api.get<PublicTenantInfo>(`/api/public/tenants/${slug}`);
        setTenant(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Igreja não encontrada ou link inativo.';
        setTenantError(message);
      } finally {
        setLoadingTenant(false);
      }
    }
    loadTenant();
  }, [slug, initialTenant]);

  function maskCpf(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }

  function maskDate(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }

  function parseDateIso(val: string): string | undefined {
    const digits = val.replace(/\D/g, '');
    if (digits.length !== 8) return undefined;
    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4, 8));
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return undefined;
    }
    const utcCheck = new Date(Date.UTC(year, month - 1, day));
    if (
      utcCheck.getUTCFullYear() !== year ||
      utcCheck.getUTCMonth() !== month - 1 ||
      utcCheck.getUTCDate() !== day
    ) {
      return undefined;
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!consentimentoLgpd) {
      setError('Por favor, aceite os termos de consentimento para enviar a ficha.');
      return;
    }

    if (tab === 'MEMBRO' && (!email || !email.trim())) {
      setError('E-mail é obrigatório para cadastro de membro.');
      return;
    }

    const parsedBirthDate = parseDateIso(dataNascimento);
    if (dataNascimento.trim() && !parsedBirthDate) {
      setError('Data de nascimento inválida. Informe no formato DD/MM/AAAA.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        tipo: tab,
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() ? email.trim() : undefined,
        cpf: cpf ? cpf.replace(/\D/g, '') : undefined,
        dataNascimento: parsedBirthDate,
        sexo: sexo ? sexo : undefined,
        estadoCivil: estadoCivil ? estadoCivil : undefined,
        batizadoAguas: batizadoAguas === 'true' ? true : batizadoAguas === 'false' ? false : undefined,
        igrejaAnterior: igrejaAnterior.trim() ? igrejaAnterior.trim() : undefined,
        quemConvidou: quemConvidou.trim() ? quemConvidou.trim() : undefined,
        observacoes: observacoes.trim() ? observacoes.trim() : undefined,
        consentimentoLgpd,
        website: honeypot || undefined,
      };

      await api.post(`/api/public/tenants/${slug}/members/submit`, payload);
      setSubmitted(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Erro ao enviar ficha. Verifique as informações e tente novamente.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSubmitted(false);
    setNome('');
    setTelefone('');
    setEmail('');
    setCpf('');
    setDataNascimento('');
    setSexo('');
    setEstadoCivil('');
    setBatizadoAguas('');
    setIgrejaAnterior('');
    setQuemConvidou('');
    setObservacoes('');
    setConsentimentoLgpd(false);
    setError(null);
  }

  if (loadingTenant) {
    return (
      <div className="public-site-root flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--site-accent)]" />
          <p className="text-sm font-medium text-zinc-400">Carregando informações da igreja...</p>
        </div>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="public-site-root flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#121216] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-white">Página Indisponível</h2>
          <p className="mb-6 text-sm text-zinc-400">{tenantError || 'Esta igreja não foi encontrada.'}</p>
          <p className="text-xs text-zinc-500">Verifique o endereço digitado ou solicite um novo link à liderança.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-site-root relative min-h-screen overflow-x-clip bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12">
      {/* Textura e brilho sutil no mesmo padrão visual do portal */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl"
      />

      <div className="relative z-10 mx-auto w-full max-w-lg space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <Link
            href={siteHomeHref}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-zinc-300 transition hover:border-amber-400/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[var(--site-accent)]" aria-hidden="true" />
            <span>Voltar para o site</span>
          </Link>

          <Link
            href={memberLoginHref}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <span>Área de Membros</span>
          </Link>
        </div>

        {/* Cabeçalho de Identidade Visual da Igreja */}
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <ChurchBrandMark
              logoUrl={tenant.logoUrl}
              churchName={tenant.nome}
              size="lg"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              Conexão & Boas-vindas
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-[1.75rem] [text-wrap:balance]">
              {tenant.nome}
            </h1>
            <p className="text-sm text-zinc-400">
              Ficha oficial de boas-vindas e auto-cadastro
            </p>
          </div>
        </div>

        {submitted ? (
          /* Tela de Sucesso Acolhedora */
          <div className="space-y-6 overflow-hidden rounded-3xl border border-stone-200/90 bg-white p-8 text-center text-zinc-900 shadow-2xl [color-scheme:light]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-zinc-950">Ficha Enviada com Sucesso!</h2>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-stone-600">
                Que alegria ter você conosco! Sua ficha foi recebida com carinho pela equipe pastoral de <strong>{tenant.nome}</strong>.
              </p>
            </div>

            {tab === 'MEMBRO' && (
              <div className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left text-xs text-zinc-900">
                <p className="flex items-center gap-1.5 font-semibold text-zinc-950">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  Próximo passo de acesso ao sistema
                </p>
                <p className="text-stone-700">
                  Após a aprovação pela secretaria, você receberá uma mensagem no WhatsApp com o link para ativação da sua conta e acesso ao sistema da igreja.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition-colors hover:bg-stone-50"
              >
                Enviar Outro Cadastro
              </button>
              <Link
                href={siteHomeHref}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[var(--site-accent)] px-4 text-sm font-bold text-[var(--site-accent-foreground)] transition-colors hover:bg-[var(--site-accent-hover)]"
              >
                Voltar para o site
              </Link>
            </div>
          </div>
        ) : (
          /* Formulário Principal com Alternância */
          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-white text-zinc-900 shadow-2xl [color-scheme:light]">
            {/* Seletor de Perfil (Tabs) */}
            <div className="grid grid-cols-2 gap-1.5 border-b border-stone-200/80 bg-[#f4f2ed] p-1.5">
              <button
                type="button"
                onClick={() => { setTab('VISITANTE'); setError(null); }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold transition-all ${
                  tab === 'VISITANTE'
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'text-stone-600 hover:text-zinc-950'
                }`}
              >
                <Heart className={`h-4 w-4 ${tab === 'VISITANTE' ? 'fill-amber-400 text-amber-400' : 'text-stone-400'}`} />
                Sou Visitante
              </button>
              <button
                type="button"
                onClick={() => { setTab('MEMBRO'); setError(null); }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold transition-all ${
                  tab === 'MEMBRO'
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'text-stone-600 hover:text-zinc-950'
                }`}
              >
                <UserPlus className={`h-4 w-4 ${tab === 'MEMBRO' ? 'text-amber-400' : 'text-stone-400'}`} />
                Quero ser Membro
              </button>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              {/* Mensagem de acolhimento do perfil */}
              <div className="rounded-2xl border border-stone-200/70 bg-[#faf9f6] p-3.5 text-xs leading-relaxed text-stone-600">
                {tab === 'VISITANTE' ? (
                  <span>
                    Ficamos muito felizes com a sua visita! Preencha seus dados de contato para que possamos orar por você e te acolher na igreja.
                  </span>
                ) : (
                  <span>
                    Deseja congregar e caminhar conosco na fé? Preencha esta ficha oficial para avaliação e acolhimento da equipe pastoral.
                  </span>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot invisível para bots */}
                <div className="hidden" aria-hidden="true">
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHoneypot(e.target.value)}
                  />
                </div>

                {/* Nome Completo */}
                <InputField
                  id="join-nome"
                  name="name"
                  autoComplete="name"
                  label="Nome Completo"
                  required
                  placeholder="Seu nome completo"
                  value={nome}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNome(e.target.value)}
                  className={SITE_INPUT_CLASS}
                />

                {/* WhatsApp / Celular */}
                <InternationalPhoneInput
                  id="join-telefone"
                  label="WhatsApp / Celular"
                  countryLabel="País"
                  required
                  value={telefone}
                  onChange={setTelefone}
                  placeholder="(00) 00000-0000"
                  variant="site-light"
                />

                {/* E-mail (Obrigatório para membro, opcional para visitante) */}
                <div>
                  <InputField
                    id="join-email"
                    name="email"
                    label="E-mail"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    required={tab === 'MEMBRO'}
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className={SITE_INPUT_CLASS}
                  />
                  <p className="mt-1 text-xs text-stone-500">
                    {tab === 'MEMBRO'
                      ? 'Necessário para acessar o sistema da igreja.'
                      : 'Opcional. Para receber novidades e informativos.'}
                  </p>
                </div>

                {/* Data de Nascimento e CPF */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InputField
                    id="join-nascimento"
                    name="bday"
                    autoComplete="bday"
                    inputMode="numeric"
                    label="Data de Nascimento"
                    placeholder="DD/MM/AAAA"
                    value={dataNascimento}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDataNascimento(maskDate(e.target.value))}
                    className={SITE_INPUT_CLASS}
                  />

                  {tab === 'MEMBRO' && (
                    <div>
                      <InputField
                        id="join-cpf"
                        name="cpf"
                        inputMode="numeric"
                        label="CPF"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCpf(maskCpf(e.target.value))}
                        className={SITE_INPUT_CLASS}
                      />
                      <p className="mt-1 text-xs text-stone-500">Opcional. Apenas números.</p>
                    </div>
                  )}
                </div>

                {/* Campos adicionais para MEMBRO */}
                {tab === 'MEMBRO' && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <SelectField
                        id="join-sexo"
                        name="sex"
                        label="Sexo"
                        value={sexo}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSexo(e.target.value)}
                        className={SITE_INPUT_CLASS}
                      >
                        <option value="">Selecione...</option>
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMININO">Feminino</option>
                      </SelectField>

                      <SelectField
                        id="join-estado-civil"
                        name="maritalStatus"
                        label="Estado Civil"
                        value={estadoCivil}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstadoCivil(e.target.value)}
                        className={SITE_INPUT_CLASS}
                      >
                        <option value="">Selecione...</option>
                        <option value="SOLTEIRO">Solteiro(a)</option>
                        <option value="CASADO">Casado(a)</option>
                        <option value="DIVORCIADO">Divorciado(a)</option>
                        <option value="VIUVO">Viúvo(a)</option>
                        <option value="UNIAO_ESTAVEL">União Estável</option>
                      </SelectField>
                    </div>

                    <SelectField
                      id="join-batismo"
                      name="baptized"
                      label="Já é batizado nas águas?"
                      value={batizadoAguas}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setBatizadoAguas(e.target.value as 'true' | 'false' | '')
                      }
                      className={SITE_INPUT_CLASS}
                    >
                      <option value="">Prefiro não informar</option>
                      <option value="true">Sim, sou batizado(a)</option>
                      <option value="false">Não sou batizado(a)</option>
                    </SelectField>

                    <div>
                      <InputField
                        id="join-igreja-anterior"
                        name="previousChurch"
                        label="Igreja anterior"
                        placeholder="Nome da igreja onde congregava anteriormente"
                        value={igrejaAnterior}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIgrejaAnterior(e.target.value)}
                        className={SITE_INPUT_CLASS}
                      />
                      <p className="mt-1 text-xs text-stone-500">Opcional. Se era membro de outro ministério.</p>
                    </div>
                  </>
                )}

                {/* Quem convidou você */}
                <InputField
                  id="join-quem-convidou"
                  name="invitedBy"
                  label="Quem convidou você?"
                  placeholder="Nome de quem te trouxe ou como conheceu a igreja"
                  value={quemConvidou}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuemConvidou(e.target.value)}
                  className={SITE_INPUT_CLASS}
                />

                {/* Observações / Mensagem */}
                <TextareaField
                  id="join-observacoes"
                  name="notes"
                  label={tab === 'VISITANTE' ? 'Pedido de oração ou observação' : 'Observações adicionais'}
                  placeholder="Escreva aqui caso queira compartilhar algo com a equipe pastoral..."
                  value={observacoes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservacoes(e.target.value)}
                  rows={2}
                  className={SITE_INPUT_CLASS}
                />

                {/* Consentimento LGPD */}
                <div className="pt-2">
                  <label htmlFor="join-lgpd" className="group flex cursor-pointer items-start gap-3">
                    <input
                      id="join-lgpd"
                      type="checkbox"
                      checked={consentimentoLgpd}
                      onChange={(e) => setConsentimentoLgpd(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs leading-snug text-stone-600 transition-colors group-hover:text-zinc-950">
                      Concordo com o armazenamento dos meus dados para acolhimento e comunicação da igreja nos termos da LGPD.
                    </span>
                  </label>
                </div>

                {/* Botão de Envio */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--site-accent)] px-5 py-3 text-base font-bold text-[var(--site-accent-foreground)] shadow-lg shadow-amber-500/15 transition-all hover:bg-[var(--site-accent-hover)] active:scale-[0.99] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Enviando cadastro...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Enviar Cadastro</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Rodapé sutil One Elo */}
        <p className="text-center text-xs text-zinc-500">
          Tecnologia <span className="font-semibold text-zinc-300">One Elo</span>
        </p>
      </div>
    </div>
  );
}
