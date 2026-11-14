'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import type {
  CustomDomainStatusResponse,
  DnsStatus,
  DnsTargetsInfo,
  DomainVerificationChallenge,
} from '@/lib/api-website';
import { InputField } from '@/components/app/form-field';
import { ConfirmDialog } from '@/components/app/confirm-dialog';

interface DomainSetupCardProps {
  tenantSlug: string;
  tenantPlano: 'GRATUITO' | 'BASICO' | 'PROFISSIONAL';
  canUseCustomDomain: boolean;
  isAdmin: boolean;
  initialDomain: string | null;
  initialDnsStatus: DnsStatus;
  initialDnsCheckedAt: string | null;
  initialVerifiedAt: string | null;
  dnsTargets: DnsTargetsInfo;
  onDomainChanged?: () => Promise<void> | void;
}

function isLikelyApexDomain(domain: string): boolean {
  const labels = domain.split('.').filter(Boolean);
  if (labels.length <= 2) return true;
  if (labels.length === 3 && labels[1].length <= 3 && labels[2].length === 2) {
    return true;
  }
  return false;
}

function formatDateTimeBr(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DNS_STATUS_META: Record<
  DnsStatus,
  { label: string; className: string; helper: string }
> = {
  ACTIVE: {
    label: 'Ativo e com SSL',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    helper: 'Seu domínio próprio já responde o portal da igreja com HTTPS.',
  },
  PENDING: {
    label: 'Aguardando Apontamento',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    helper:
      'Configure os registros DNS no seu provedor e clique em Verificar Apontamento.',
  },
  ERROR: {
    label: 'Erro de Configuração',
    className: 'border-red-200 bg-red-50 text-red-700',
    helper:
      'O DNS ainda não aponta para o One Elo ou há conflito com outro provedor.',
  },
};

export function DomainSetupCard({
  tenantSlug,
  tenantPlano,
  canUseCustomDomain,
  isAdmin,
  initialDomain,
  initialDnsStatus,
  initialDnsCheckedAt,
  initialVerifiedAt,
  dnsTargets,
  onDomainChanged,
}: DomainSetupCardProps) {
  const [savedDomain, setSavedDomain] = useState<string | null>(initialDomain);
  const [domainInput, setDomainInput] = useState<string>(initialDomain ?? '');
  const [dnsStatus, setDnsStatus] = useState<DnsStatus>(initialDnsStatus);
  const [dnsCheckedAt, setDnsCheckedAt] = useState<string | null>(
    initialDnsCheckedAt,
  );
  const [verifiedAt, setVerifiedAt] = useState<string | null>(initialVerifiedAt);
  const [challenges, setChallenges] = useState<DomainVerificationChallenge[]>([]);
  const [verificationDetails, setVerificationDetails] = useState<string | null>(
    null,
  );
  const [observedRecords, setObservedRecords] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const canManage = isAdmin && canUseCustomDomain;
  const activeDomain = savedDomain;
  const showApexGuide = activeDomain ? isLikelyApexDomain(activeDomain) : false;

  async function handleCopy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard fallback unavailable
    }
  }

  async function handleSaveDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    const candidate = domainInput.trim();
    if (!candidate) {
      setFeedback({
        type: 'error',
        message: 'Informe o domínio da igreja antes de salvar.',
      });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const response = await api.put<CustomDomainStatusResponse>(
        '/api/site/custom-domain',
        { customDomain: candidate },
      );

      setSavedDomain(response.customDomain);
      setDomainInput(response.customDomain ?? candidate);
      setDnsStatus(response.dnsStatus);
      setDnsCheckedAt(response.dnsCheckedAt ?? null);
      setVerifiedAt(response.customDomainVerifiedAt ?? null);
      setChallenges(response.verificationChallenges ?? []);
      setObservedRecords([]);
      setVerificationDetails(null);

      await onDomainChanged?.();
      setFeedback({
        type: 'success',
        message:
          response.dnsStatus === 'ACTIVE'
            ? 'Domínio salvo e já verificado com sucesso.'
            : 'Domínio registrado na Vercel. Configure o DNS abaixo e clique em Verificar Apontamento.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof HttpError
            ? err.message
            : 'Não foi possível salvar o domínio personalizado.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyDomain() {
    if (!canManage || !savedDomain) return;

    try {
      setVerifying(true);
      setFeedback(null);

      const response = await api.post<CustomDomainStatusResponse>(
        '/api/site/custom-domain/verify',
      );

      setDnsStatus(response.dnsStatus);
      setDnsCheckedAt(response.dnsCheckedAt ?? null);
      setVerifiedAt(response.customDomainVerifiedAt ?? null);
      setChallenges(response.verificationChallenges ?? []);
      setObservedRecords(response.observedRecords ?? []);
      setVerificationDetails(response.details ?? null);

      await onDomainChanged?.();
      setFeedback({
        type: response.dnsStatus === 'ACTIVE' ? 'success' : 'error',
        message:
          response.details ||
          (response.dnsStatus === 'ACTIVE'
            ? 'Domínio verificado e ativo!'
            : 'Apontamento DNS ainda pendente.'),
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof HttpError
            ? err.message
            : 'Erro ao verificar apontamento DNS.',
      });
    } finally {
      setVerifying(false);
    }
  }

  async function handleConfirmRemove() {
    if (!canManage) return;

    try {
      setRemoving(true);
      setFeedback(null);

      await api.delete('/api/site/custom-domain');
      setSavedDomain(null);
      setDomainInput('');
      setDnsStatus('PENDING');
      setDnsCheckedAt(null);
      setVerifiedAt(null);
      setChallenges([]);
      setObservedRecords([]);
      setVerificationDetails(null);
      setConfirmRemoveOpen(false);

      await onDomainChanged?.();
      setFeedback({
        type: 'success',
        message: `Domínio próprio removido. Seu portal segue ativo em /${tenantSlug}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof HttpError
            ? err.message
            : 'Não foi possível remover o domínio próprio.',
      });
    } finally {
      setRemoving(false);
    }
  }

  const statusMeta = DNS_STATUS_META[dnsStatus];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-bold text-gray-900">
              Domínio Próprio da Igreja
            </h2>
            {activeDomain && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.className}`}
              >
                {dnsStatus === 'ACTIVE' && <CheckCircle2 className="h-3.5 w-3.5" />}
                {dnsStatus === 'PENDING' && <Clock className="h-3.5 w-3.5" />}
                {dnsStatus === 'ERROR' && <AlertTriangle className="h-3.5 w-3.5" />}
                {statusMeta.label}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Sirva o portal institucional no endereço da sua igreja (ex:{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
              www.suaigreja.org.br
            </code>
            ) com SSL automático, mantendo seu endereço padrão em{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
              /{tenantSlug}
            </code>
            .
          </p>
        </div>

        {activeDomain && dnsStatus === 'ACTIVE' && (
          <a
            href={`https://${activeDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Abrir {activeDomain}</span>
            <ExternalLink className="h-3 w-3 opacity-75" />
          </a>
        )}
      </div>

      {!canUseCustomDomain && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent-soft-border bg-accent-soft/70 p-4 text-sm text-slate-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
          <div className="space-y-1">
            <p className="font-semibold">
              Recurso exclusivo do plano Profissional (plano atual: {tenantPlano})
            </p>
            <p className="text-xs leading-relaxed text-slate-700">
              No plano atual, o site público funciona normalmente em{' '}
              <strong>/{tenantSlug}</strong>. Para utilizar domínio próprio com
              certificado SSL automático na Vercel, solicite o upgrade para o plano
              Profissional.
            </p>
          </div>
        </div>
      )}

      {canUseCustomDomain && !isAdmin && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p className="text-xs leading-relaxed">
            Apenas usuários com perfil <strong>ADMIN</strong> podem vincular,
            verificar ou remover o domínio próprio da igreja.
          </p>
        </div>
      )}

      {!dnsTargets.vercelConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            As credenciais da Vercel Domains API (
            <code>VERCEL_API_TOKEN</code> / <code>VERCEL_PROJECT_ID</code>) ainda
            não estão configuradas neste servidor. Você já pode consultar os
            apontamentos DNS recomendados abaixo.
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSaveDomain} className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <InputField
              id="website-custom-domain"
              label="Domínio Personalizado"
              placeholder="www.igrejaesperanca.org.br"
              maxLength={253}
              disabled={!canManage || saving}
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
            />
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-xs transition hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                <span>{savedDomain ? 'Atualizar Domínio' : 'Salvar Domínio'}</span>
              </button>

              {savedDomain && (
                <>
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={handleVerifyDomain}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    {verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-accent-ink" />
                    )}
                    <span>Verificar Apontamento</span>
                  </button>

                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => setConfirmRemoveOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remover</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Informe apenas o domínio ou subdomínio (sem https:// e sem / no final).
          Subdomínios como <code>www.suaigreja.org.br</code> propagam mais rápido
          via CNAME.
        </p>
      </form>

      {activeDomain && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 text-xs text-gray-600 space-y-1.5">
          <p className="font-semibold text-gray-800">{statusMeta.helper}</p>
          {verificationDetails && <p>{verificationDetails}</p>}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-500">
            {dnsCheckedAt && (
              <span>Última verificação: {formatDateTimeBr(dnsCheckedAt)}</span>
            )}
            {verifiedAt && (
              <span>Ativado em: {formatDateTimeBr(verifiedAt)}</span>
            )}
            {observedRecords.length > 0 && (
              <span>Registros detectados: {observedRecords.join(', ')}</span>
            )}
          </div>
        </div>
      )}

      {challenges.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="text-sm font-bold text-amber-950">
            Registro de Verificação Solicitado pela Vercel
          </h3>
          <div className="space-y-2">
            {challenges.map((challenge, idx) => (
              <div
                key={`${challenge.type}-${challenge.domain}-${idx}`}
                className="flex flex-col justify-between gap-2 rounded-xl border border-amber-200 bg-white p-3 text-xs sm:flex-row sm:items-center"
              >
                <div className="space-y-0.5 break-all">
                  <div className="font-semibold text-gray-900">
                    Tipo: {challenge.type} · Host: <code>{challenge.domain}</code>
                  </div>
                  <div className="text-gray-600">
                    Valor: <code className="font-mono">{challenge.value}</code>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(`challenge-${idx}`, challenge.value)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {copiedKey === `challenge-${idx}` ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar Valor</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className={`rounded-2xl border p-4 space-y-3 ${
            !showApexGuide && activeDomain
              ? 'border-accent-soft-border bg-accent-soft/50'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">
              Opção 1: Subdomínio (CNAME — Recomendado)
            </h3>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
              Ex: www ou site
            </span>
          </div>
          <p className="text-xs text-gray-500">
            No painel DNS do seu provedor (Registro.br, Cloudflare, GoDaddy), crie:
          </p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Tipo</span>
              <code className="font-semibold text-gray-900">CNAME</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Nome / Host</span>
              <code className="font-semibold text-gray-900">
                {activeDomain && !showApexGuide
                  ? activeDomain.split('.')[0]
                  : 'www'}
              </code>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Destino / Valor</span>
              <div className="flex items-center gap-1.5">
                <code className="font-semibold text-accent-ink">
                  {dnsTargets.cnameTarget}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy('cname', dnsTargets.cnameTarget)}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-200"
                  title="Copiar CNAME"
                >
                  {copiedKey === 'cname' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 space-y-3 ${
            showApexGuide
              ? 'border-accent-soft-border bg-accent-soft/50'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">
              Opção 2: Domínio Raiz (Apex — Registro A)
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              Ex: suaigreja.org.br
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Para utilizar o domínio sem <code>www</code>, configure um registro A
            (+ eventual TXT exibido após salvar):
          </p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Tipo</span>
              <code className="font-semibold text-gray-900">A</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Nome / Host</span>
              <code className="font-semibold text-gray-900">@</code>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Endereço IPv4</span>
              <div className="flex items-center gap-1.5">
                <code className="font-semibold text-accent-ink">
                  {dnsTargets.apexIp}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy('apex', dnsTargets.apexIp)}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-200"
                  title="Copiar IP"
                >
                  {copiedKey === 'apex' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmRemoveOpen}
        title="Remover Domínio Próprio"
        description={
          <>
            Tem certeza que deseja desvincular{' '}
            <strong>{savedDomain}</strong>? O site voltará a responder apenas
            em <strong>/{tenantSlug}</strong>.
          </>
        }
        confirmLabel="Remover Domínio"
        loading={removing}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemoveOpen(false)}
      />
    </div>
  );
}
