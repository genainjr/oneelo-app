'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { SkeletonList } from '@/components/app/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { InputField, PasswordField } from '@/components/app/form-field';
import { InternationalPhoneInput } from '@/components/app/international-phone-input';
import { InfoItem } from '@/components/app/info-item';
import { StatusBadge } from '@/components/app/status-badge';
import { ImageUploadPanel } from '@/components/app/image-upload-panel';
import { api } from '@/lib/api';
import { buildImageFormData, IMAGE_UPLOAD_ACCEPT, validateImageFile } from '@/lib/image-upload';
import { formatDate, formatPhone, MINISTRY_ROLE_LABEL, ROLE_LABEL, STATUS_MEMBRO_COLOR, STATUS_MEMBRO_LABEL } from '@/lib/utils';
import { AuthUser, ConnectedAuthProvider } from '@/types';
import { useAuthUser } from '@/contexts/auth-user-context';

const AUTH_PROVIDER_LABEL: Record<ConnectedAuthProvider['provider'], string> = {
  GOOGLE: 'Google',
  APPLE: 'Apple',
};

type ProfileFormState = {
  nome: string;
  nomeExibicao: string;
  whatsapp: string;
};

function buildProfileForm(user: AuthUser): ProfileFormState {
  return {
    nome: user.nome ?? '',
    nomeExibicao: user.membro?.nomeExibicao ?? '',
    whatsapp: user.membro?.whatsapp ?? '',
  };
}

export default function MeuPerfilPage() {
  const { setUser: setLayoutUser } = useAuthUser();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    nome: '',
    nomeExibicao: '',
    whatsapp: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPhonePassword, setLoginPhonePassword] = useState('');
  const [loginPhoneLoading, setLoginPhoneLoading] = useState(false);
  const [loginPhoneError, setLoginPhoneError] = useState('');
  const [loginPhoneSuccess, setLoginPhoneSuccess] = useState('');
  const [authProviders, setAuthProviders] = useState<ConnectedAuthProvider[]>([]);
  const [authProvidersLoading, setAuthProvidersLoading] = useState(false);
  const [authProviderError, setAuthProviderError] = useState('');
  const [authProviderSuccess, setAuthProviderSuccess] = useState('');
  const [unlinkingProvider, setUnlinkingProvider] = useState<ConnectedAuthProvider['provider'] | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const hasPassword = user?.hasPassword !== false;

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then((data) => {
        setUser(data);
        setProfileForm(buildProfileForm(data));
        setLoginPhone(data.telefoneLogin ?? '');
      })
      .catch(() => setError('Nao foi possivel carregar seu perfil.'))
      .finally(() => setLoading(false));
  }, []);

  function handleProfileFieldChange(field: keyof ProfileFormState, value: string) {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleResetProfileForm() {
    if (!user) return;
    setProfileError('');
    setProfileSuccess('');
    setProfileForm(buildProfileForm(user));
  }

  async function handleUpdateProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setProfileError('');
    setProfileSuccess('');

    const nome = profileForm.nome.trim();

    if (!nome) {
      setProfileError('Nome completo e obrigatorio.');
      return;
    }

    const payload = user.membro
      ? {
          nome,
          nomeExibicao: profileForm.nomeExibicao.trim() || null,
          whatsapp: profileForm.whatsapp.trim() || null,
        }
      : { nome };

    setProfileLoading(true);
    try {
      const updated = await api.patch<AuthUser>('/api/auth/me/profile', payload);
      setUser(updated);
      setLayoutUser(updated);
      setProfileForm(buildProfileForm(updated));
      setProfileSuccess('Dados pessoais atualizados com sucesso.');
    } catch (err: any) {
      setProfileError(err?.message || 'Nao foi possivel atualizar seus dados pessoais.');
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;

    setAuthProvidersLoading(true);
    setAuthProviderError('');

    api.get<ConnectedAuthProvider[]>('/api/auth/me/auth-providers')
      .then((data) => setAuthProviders(Array.isArray(data) ? data : []))
      .catch((err: any) => {
        setAuthProviderError(err?.message || 'Nao foi possivel carregar os provedores conectados.');
      })
      .finally(() => setAuthProvidersLoading(false));
  }, [user]);

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if ((hasPassword && !senhaAtual.trim()) || !novaSenha.trim() || !confirmarSenha.trim()) {
      setPasswordError('Preencha todos os campos de senha.');
      return;
    }

    if (novaSenha.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setPasswordError('A confirmacao nao confere com a nova senha.');
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await api.patch<{ message: string; hasPassword: true }>(
        '/api/auth/me/password',
        hasPassword ? { senhaAtual, novaSenha } : { novaSenha },
      );
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setUser((current) => current ? { ...current, hasPassword: true } : current);
      setLayoutUser((current) => current ? { ...current, hasPassword: true } : current);
      setPasswordSuccess(result.message);
    } catch (err: any) {
      setPasswordError(err?.message || `Não foi possível ${hasPassword ? 'alterar' : 'criar'} a senha.`);
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleUpdateLoginPhone(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginPhoneError('');
    setLoginPhoneSuccess('');

    if (!hasPassword) {
      setLoginPhoneError('Crie uma senha antes de cadastrar um telefone de login.');
      return;
    }
    if (!loginPhonePassword.trim()) {
      setLoginPhoneError('Informe sua senha atual para confirmar a alteracao.');
      return;
    }

    setLoginPhoneLoading(true);
    try {
      const result = await api.patch<{ message: string; telefoneLogin: string | null }>(
        '/api/auth/me/login-phone',
        {
          senhaAtual: loginPhonePassword,
          telefoneLogin: loginPhone.trim() || null,
        },
      );
      setLoginPhone(result.telefoneLogin ?? '');
      setLoginPhonePassword('');
      setUser((current) =>
        current ? { ...current, telefoneLogin: result.telefoneLogin } : current,
      );
      setLayoutUser((current) =>
        current ? { ...current, telefoneLogin: result.telefoneLogin } : current,
      );
      setLoginPhoneSuccess(result.message);
    } catch (err: any) {
      setLoginPhoneError(err?.message || 'Nao foi possivel atualizar o telefone de login.');
    } finally {
      setLoginPhoneLoading(false);
    }
  }

  async function handleUnlinkProvider(provider: ConnectedAuthProvider['provider']) {
    const label = AUTH_PROVIDER_LABEL[provider] || provider;
    const confirmed = window.confirm(`Deseja desvincular sua conta ${label} do One Elo?`);

    if (!confirmed) return;

    setAuthProviderError('');
    setAuthProviderSuccess('');
    setUnlinkingProvider(provider);

    try {
      await api.delete(`/api/auth/me/auth-providers/${provider}`);
      setAuthProviders((current) => current.filter((item) => item.provider !== provider));
      setAuthProviderSuccess(`Conta ${label} desvinculada com sucesso.`);
    } catch (err: any) {
      setAuthProviderError(err?.message || `Nao foi possivel desvincular a conta ${label}.`);
    } finally {
      setUnlinkingProvider(null);
    }
  }

  function openPhotoPicker() {
    photoInputRef.current?.click();
  }

  async function handlePhotoSelected(file: File | undefined) {
    if (!user?.membro || !file) return;

    setPhotoError('');
    setPhotoSuccess('');

    const validationError = validateImageFile(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }

    setPhotoLoading(true);
    try {
      const updated = await api.post<AuthUser['membro']>(`/api/auth/me/photo`, buildImageFormData(file));
      const nextUser: AuthUser = {
        ...user,
        membro: updated ?? user.membro,
      };
      setUser(nextUser);
      setLayoutUser(nextUser);
      setPhotoSuccess('Foto atualizada com sucesso.');
    } catch (err: any) {
      setPhotoError(err?.message || 'Nao foi possivel atualizar a foto.');
    } finally {
      setPhotoLoading(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  }

  async function handleRemovePhoto() {
    if (!user?.membro) return;

    setPhotoError('');
    setPhotoSuccess('');
    setPhotoRemoving(true);
    try {
      await api.delete(`/api/auth/me/photo`);
      const nextUser: AuthUser = {
        ...user,
        membro: {
          ...user.membro,
          fotoUrl: null,
          fotoKey: null,
        },
      };
      setUser(nextUser);
      setLayoutUser(nextUser);
      setPhotoSuccess('Foto removida com sucesso.');
    } catch (err: any) {
      setPhotoError(err?.message || 'Nao foi possivel remover a foto.');
    } finally {
      setPhotoRemoving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Meu Perfil"
        description="Consulte seus dados de acesso, cadastro e participacao em ministerios."
      />

      {loading ? (
        <SkeletonList count={2} className="h-40 rounded-2xl" gap="space-y-4" />
      ) : error ? (
        <EmptyState title="Erro ao carregar perfil" description={error} />
      ) : user ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Dados da conta</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">{user.nome}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>

              {user.membro && (
                <div className="w-full lg:w-[calc((100%_-_0.75rem)/2)] lg:max-w-none lg:shrink-0">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept={IMAGE_UPLOAD_ACCEPT}
                    className="hidden"
                    onChange={(event) => handlePhotoSelected(event.target.files?.[0])}
                  />
                  <ImageUploadPanel
                    title="Foto do membro"
                    description="A imagem usada nas telas e impressoes do sistema sera a foto deste cadastro."
                    imageUrl={user.membro.fotoUrl}
                    fallbackName={user.membro.nome || user.nome}
                    alt={user.membro.nome}
                    uploading={photoLoading}
                    removing={photoRemoving}
                    removeDisabled={!user.membro.fotoUrl}
                    onUploadClick={openPhotoPicker}
                    onRemoveClick={handleRemovePhoto}
                  />
                </div>
              )}
            </div>

            {photoError && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {photoError}
              </p>
            )}
            {photoSuccess && (
              <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {photoSuccess}
              </p>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoItem label="Perfil de acesso" value={ROLE_LABEL[user.role]} />
              <InfoItem label="Igreja" value={user.tenant?.nome || '-'} />
              <InfoItem label="Plano" value={user.tenant?.plano || '-'} />
              <InfoItem label="Criado em" value={formatDate(user.createdAt, 'dd/MM/yyyy')} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-gray-900">Telefone de login</h2>
                <p className="text-sm text-gray-500">
                  Selecione o país e informe o número local. Esta credencial é separada do WhatsApp do cadastro de membro.
                </p>
              </div>

              {!hasPassword && (
                <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  Crie uma senha na secao de seguranca antes de cadastrar um telefone de login.
                </p>
              )}

              <form onSubmit={handleUpdateLoginPhone} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InternationalPhoneInput
                    id="login-phone"
                    label="Telefone de login"
                    optionalLabel="Deixe vazio para remover"
                    countryLabel="País do telefone de login"
                    value={loginPhone}
                    onChange={setLoginPhone}
                    disabled={!hasPassword}
                  />
                  <PasswordField
                    id="login-phone-password"
                    label="Senha atual"
                    value={loginPhonePassword}
                    onChange={(event) => setLoginPhonePassword(event.target.value)}
                    autoComplete="current-password"
                    disabled={!hasPassword}
                  />
                </div>

                {loginPhoneError && (
                  <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {loginPhoneError}
                  </p>
                )}
                {loginPhoneSuccess && (
                  <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {loginPhoneSuccess}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!hasPassword || loginPhoneLoading}
                    className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loginPhoneLoading ? 'Salvando...' : 'Salvar telefone de login'}
                  </button>
                </div>
              </form>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Dados pessoais</h2>
              <p className="text-sm text-gray-500">
                Atualize as informacoes usadas para identificacao no sistema e nas impressoes.
              </p>
            </div>

            {!user.membro && (
              <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Seu usuario ainda nao possui membro vinculado. Por enquanto, somente o nome completo pode ser alterado aqui.
              </p>
            )}

            <form onSubmit={handleUpdateProfile} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  id="profile-nome"
                  label="Nome completo"
                  required
                  value={profileForm.nome}
                  onChange={(event) => handleProfileFieldChange('nome', event.target.value)}
                  autoComplete="name"
                />
                <InputField
                  id="profile-nome-exibicao"
                  label="Nome de impressao"
                  optionalLabel={user.membro ? 'Opcional' : 'Requer membro vinculado'}
                  value={profileForm.nomeExibicao}
                  onChange={(event) => handleProfileFieldChange('nomeExibicao', event.target.value)}
                  disabled={!user.membro}
                />
                <InputField
                  id="profile-whatsapp"
                  label="Telefone"
                  optionalLabel={user.membro ? 'Opcional' : 'Requer membro vinculado'}
                  value={profileForm.whatsapp}
                  onChange={(event) => handleProfileFieldChange('whatsapp', event.target.value)}
                  autoComplete="tel"
                  disabled={!user.membro}
                />
              </div>

              {profileError && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {profileError}
                </p>
              )}
              {profileSuccess && (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {profileSuccess}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleResetProfileForm}
                  disabled={profileLoading}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Descartar alteracoes
                </button>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {profileLoading ? 'Salvando...' : 'Salvar dados'}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Segurança</h2>
              <p className="text-sm text-gray-500">
                {hasPassword
                  ? 'Altere sua senha de acesso informando a senha atual.'
                  : 'Crie uma senha para também entrar no One Elo usando e-mail e senha.'}
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
              <div className={`grid gap-4 ${hasPassword ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {hasPassword && (
                  <PasswordField
                    id="senha-atual"
                    label="Senha atual"
                    value={senhaAtual}
                    autoComplete="current-password"
                    onChange={(e) => setSenhaAtual(e.target.value)}
                  />
                )}
                <PasswordField
                  id="nova-senha"
                  label="Nova senha"
                  value={novaSenha}
                  autoComplete="new-password"
                  onChange={(e) => setNovaSenha(e.target.value)}
                />
                <PasswordField
                  id="confirmar-senha"
                  label="Confirmar nova senha"
                  value={confirmarSenha}
                  autoComplete="new-password"
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                />
              </div>

              {passwordError && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {passwordError}
                </p>
              )}
              {passwordSuccess && (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {passwordSuccess}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {passwordLoading ? 'Salvando...' : hasPassword ? 'Alterar senha' : 'Criar senha'}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Login conectado</h2>
              <p className="text-sm text-gray-500">
                Gerencie as contas externas que podem ser usadas para entrar no One Elo.
              </p>
            </div>

            {authProviderError && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {authProviderError}
              </p>
            )}
            {authProviderSuccess && (
              <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {authProviderSuccess}
              </p>
            )}

            <div className="mt-5">
              {authProvidersLoading ? (
                <SkeletonList count={1} className="h-20 rounded-2xl" />
              ) : authProviders.length ? (
                <div className="space-y-3">
                  {authProviders.map((provider) => {
                    const label = AUTH_PROVIDER_LABEL[provider.provider] || provider.provider;
                    const unlinking = unlinkingProvider === provider.provider;

                    return (
                      <div
                        key={provider.provider}
                        className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {provider.avatarUrl ? (
                            <img
                              src={provider.avatarUrl}
                              alt={provider.displayName || provider.email || label}
                              className="h-11 w-11 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-indigo-700 ring-1 ring-gray-200">
                              {label.slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">{label}</p>
                              {provider.emailVerified && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  E-mail verificado
                                </span>
                              )}
                            </div>
                            <p className="truncate text-sm text-gray-500">
                              {provider.email || 'E-mail nao informado pelo provedor'}
                            </p>
                            <p className="text-xs text-gray-400">
                              Vinculado em {formatDate(provider.linkedAt, 'dd/MM/yyyy')}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnlinkProvider(provider.provider)}
                          disabled={!provider.canUnlink || unlinking}
                          className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          title={!provider.canUnlink ? 'Este provedor nao pode ser removido porque voce ficaria sem forma valida de acesso.' : undefined}
                        >
                          {unlinking ? 'Removendo...' : 'Desvincular'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5">
                  <p className="text-sm font-semibold text-gray-700">Nenhuma conta externa conectada.</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Para conectar uma conta externa, saia do sistema e use uma opcao de login social na tela de login.
                  </p>
                </div>
              )}
            </div>
          </section>

          {user.membro ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Cadastro de membro</h2>
                  <p className="text-sm text-gray-500">Dados vinculados ao seu usuario.</p>
                </div>
                <StatusBadge
                  label={STATUS_MEMBRO_LABEL[user.membro.status]}
                  className={`rounded-lg px-2.5 py-1 font-bold ${STATUS_MEMBRO_COLOR[user.membro.status]}`}
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <InfoItem label="Nome" value={user.membro.nome} />
                <InfoItem label="Nome de impressao" value={user.membro.nomeExibicao || '-'} />
                <InfoItem label="E-mail" value={user.membro.email || '-'} />
                <InfoItem label="WhatsApp" value={formatPhone(user.membro.whatsapp)} />
                <InfoItem label="Nascimento" value={formatDate(user.membro.dataNascimento, 'dd/MM/yyyy')} />
              </div>

              <div className="mt-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Ministerios</h3>
                {user.membro.ministerios?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {user.membro.ministerios.map((item) => (
                      <span key={item.ministerio.id} className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                        {item.ministerio.nome} - {MINISTRY_ROLE_LABEL[item.role] || item.role}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhum ministerio vinculado.</p>
                )}
              </div>
            </section>
          ) : (
            <EmptyState title="Sem membro vinculado" description="Seu usuario ainda nao esta vinculado a um cadastro de membro." />
          )}
        </div>
      ) : null}
    </div>
  );
}
