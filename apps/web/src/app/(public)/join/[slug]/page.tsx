'use client';

import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InputField, SelectField, TextareaField } from '@/components/app/form-field';
import { InternationalPhoneInput } from '@/components/app/international-phone-input';
import {
  Church,
  Heart,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Send,
} from 'lucide-react';

interface PublicTenantInfo {
  nome: string;
  slug: string;
  logoUrl?: string | null;
}

export default function PublicJoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tenant, setTenant] = useState<PublicTenantInfo | null>(null);
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

  // Carregar dados públicos do tenant
  useEffect(() => {
    async function loadTenant() {
      try {
        setLoadingTenant(true);
        const data = await api.get<PublicTenantInfo>(`/api/public/tenants/${slug}`);
        setTenant(data);
      } catch (err: any) {
        setTenantError(err.message || 'Igreja não encontrada ou link inativo.');
      } finally {
        setLoadingTenant(false);
      }
    }
    loadTenant();
  }, [slug]);

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
    if (digits.length === 8) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4, 8);
      return `${y}-${m}-${d}`;
    }
    return undefined;
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

    try {
      setSubmitting(true);

      const payload = {
        tipo: tab,
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() ? email.trim() : undefined,
        cpf: cpf ? cpf.replace(/\D/g, '') : undefined,
        dataNascimento: parseDateIso(dataNascimento),
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
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar ficha. Verifique as informações e tente novamente.');
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-gray-500">Carregando informações da igreja...</p>
        </div>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center p-8 border border-gray-200 bg-white rounded-2xl shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Página Indisponível</h2>
          <p className="text-sm text-gray-600 mb-6">{tenantError || 'Esta igreja não foi encontrada.'}</p>
          <p className="text-xs text-gray-400">Verifique o endereço digitado ou solicite um novo link à liderança.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-gray-50 to-gray-100 py-8 px-4 sm:px-6 flex flex-col justify-center items-center">
      <div className="w-full max-w-lg space-y-6">
        {/* Cabeçalho de Identidade Visual da Igreja */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.nome}
                className="h-16 w-16 object-contain rounded-2xl shadow-sm border border-white bg-white p-1"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
                <Church className="h-8 w-8" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              {tenant.nome}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Ficha oficial de boas-vindas e auto-cadastro
            </p>
          </div>
        </div>

        {submitted ? (
          /* Tela de Sucesso Acolhedora */
          <div className="border border-emerald-100 bg-white shadow-lg rounded-2xl overflow-hidden p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Ficha Enviada com Sucesso!</h2>
              <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
                Que alegria ter você conosco! Sua ficha foi recebida com carinho pela equipe pastoral de <strong>{tenant.nome}</strong>.
              </p>
            </div>

            {tab === 'MEMBRO' && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900 text-left space-y-1">
                <p className="font-semibold text-indigo-950 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Próximo passo de acesso ao sistema
                </p>
                <p>
                  Após a aprovação pela secretaria, você receberá uma mensagem no WhatsApp com o link para ativação da sua conta e acesso ao sistema da igreja.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
            >
              Enviar Outro Cadastro
            </button>
          </div>
        ) : (
          /* Formulário Principal com Alternância */
          <div className="border border-gray-200/80 bg-white shadow-xl rounded-2xl overflow-hidden">
            {/* Seletor de Perfil (Tabs) */}
            <div className="grid grid-cols-2 p-1.5 bg-gray-100/90 border-b border-gray-200/80 gap-1.5">
              <button
                type="button"
                onClick={() => { setTab('VISITANTE'); setError(null); }}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                  tab === 'VISITANTE'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Heart className={`h-4 w-4 ${tab === 'VISITANTE' ? 'text-rose-500 fill-rose-500' : 'text-gray-400'}`} />
                Sou Visitante
              </button>
              <button
                type="button"
                onClick={() => { setTab('MEMBRO'); setError(null); }}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                  tab === 'MEMBRO'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserPlus className={`h-4 w-4 ${tab === 'MEMBRO' ? 'text-indigo-600' : 'text-gray-400'}`} />
                Quero ser Membro
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Mensagem de acolhimento do perfil */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3.5 text-xs text-gray-600 leading-relaxed">
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
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
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
                  label="Nome Completo"
                  required
                  placeholder="Seu nome completo"
                  value={nome}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNome(e.target.value)}
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
                />

                {/* E-mail (Obrigatório para membro, opcional para visitante) */}
                <div>
                  <InputField
                    label="E-mail"
                    type="email"
                    required={tab === 'MEMBRO'}
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {tab === 'MEMBRO'
                      ? 'Necessário para acessar o sistema da igreja.'
                      : 'Opcional. Para receber novidades e informativos.'}
                  </p>
                </div>

                {/* Data de Nascimento e CPF */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Data de Nascimento"
                    placeholder="DD/MM/AAAA"
                    value={dataNascimento}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDataNascimento(maskDate(e.target.value))}
                  />

                  {tab === 'MEMBRO' && (
                    <div>
                      <InputField
                        label="CPF"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCpf(maskCpf(e.target.value))}
                      />
                      <p className="mt-1 text-xs text-gray-500">Opcional. Apenas números.</p>
                    </div>
                  )}
                </div>

                {/* Campos adicionais para MEMBRO */}
                {tab === 'MEMBRO' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SelectField
                        label="Sexo"
                        value={sexo}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSexo(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMININO">Feminino</option>
                      </SelectField>

                      <SelectField
                        label="Estado Civil"
                        value={estadoCivil}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstadoCivil(e.target.value)}
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
                      label="Já é batizado nas águas?"
                      value={batizadoAguas}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBatizadoAguas(e.target.value as any)}
                    >
                      <option value="">Prefiro não informar</option>
                      <option value="true">Sim, sou batizado(a)</option>
                      <option value="false">Não sou batizado(a)</option>
                    </SelectField>

                    <div>
                      <InputField
                        label="Igreja anterior"
                        placeholder="Nome da igreja onde congregava anteriormente"
                        value={igrejaAnterior}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIgrejaAnterior(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-gray-500">Opcional. Se era membro de outro ministério.</p>
                    </div>
                  </>
                )}

                {/* Quem convidou você */}
                <InputField
                  label="Quem convidou você?"
                  placeholder="Nome de quem te trouxe ou como conheceu a igreja"
                  value={quemConvidou}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuemConvidou(e.target.value)}
                />

                {/* Observações / Mensagem */}
                <TextareaField
                  label={tab === 'VISITANTE' ? 'Pedido de oração ou observação' : 'Observações adicionais'}
                  placeholder="Escreva aqui caso queira compartilhar algo com a equipe pastoral..."
                  value={observacoes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservacoes(e.target.value)}
                  rows={2}
                />

                {/* Consentimento LGPD */}
                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={consentimentoLgpd}
                      onChange={(e) => setConsentimentoLgpd(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-600 leading-snug group-hover:text-gray-900 transition-colors">
                      Concordo com o armazenamento dos meus dados para acolhimento e comunicação da igreja nos termos da LGPD.
                    </span>
                  </label>
                </div>

                {/* Botão de Envio */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-base font-semibold text-white shadow-md hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 transition-all"
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
        <p className="text-center text-xs text-gray-400">
          Plataforma de Gestão Eclesiástica One Elo
        </p>
      </div>
    </div>
  );
}
