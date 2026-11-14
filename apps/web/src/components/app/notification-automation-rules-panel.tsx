'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Gift,
  PartyPopper,
  Calendar,
  Clock,
  Bell,
  RotateCcw,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { InputField, TextareaField, SelectField } from '@/components/app/form-field';
import { Skeleton } from '@/components/app/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import type {
  NotificationAutomationRule,
  NotificationAutomationType,
} from '@/types';

const RULE_ICONS: Record<NotificationAutomationType, React.ReactNode> = {
  BIRTHDAY_PERSONAL: <Gift className="w-5 h-5 text-pink-500" />,
  BIRTHDAY_COMMUNITY: <PartyPopper className="w-5 h-5 text-amber-500" />,
  SCHEDULE_DAY_REMINDER: <Clock className="w-5 h-5 text-accent-ink" />,
  SCHEDULE_CONFIRMATION_24H: <AlertCircle className="w-5 h-5 text-rose-500" />,
  EVENT_REMINDER_BEFORE: <Calendar className="w-5 h-5 text-emerald-500" />,
};

const SAMPLE_VARS: Record<string, string> = {
  nome: 'Lucas Silva',
  igreja: 'Igreja Central',
  ministerio: 'Louvor e Adoração',
  horario: '19:30',
  evento: 'Culto de Celebração',
  antecedencia: '2 horas',
};

function renderPreview(text: string): string {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return SAMPLE_VARS[key] || match;
  });
}

export function NotificationAutomationRulesPanel() {
  const [rules, setRules] = useState<NotificationAutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resettingTipo, setResettingTipo] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<NotificationAutomationRule[]>('/api/notifications/automation-rules');
      setRules(data);
    } catch (err: any) {
      setError(err?.data?.message || err?.message || 'Erro ao carregar regras de automação.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleFieldChange = (
    tipo: NotificationAutomationType,
    field: keyof NotificationAutomationRule,
    value: any,
  ) => {
    setRules((prev) =>
      prev.map((r) =>
        r.tipo === tipo ? { ...r, [field]: value, isCustom: true } : r,
      ),
    );
    setSaveSuccess(false);
  };

  const insertVariable = (tipo: NotificationAutomationType, variableTag: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.tipo !== tipo) return r;
        const currentMsg = r.mensagem || '';
        const separator = currentMsg.length > 0 && !currentMsg.endsWith(' ') ? ' ' : '';
        return {
          ...r,
          mensagem: `${currentMsg}${separator}${variableTag}`,
          isCustom: true,
        };
      }),
    );
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const payload = {
        regras: rules.map((r) => ({
          tipo: r.tipo,
          ativo: r.ativo,
          horario: r.horario,
          antecedenciaHoras: r.antecedenciaHoras,
          titulo: r.titulo,
          mensagem: r.mensagem,
        })),
      };

      const updated = await api.put<NotificationAutomationRule[]>(
        '/api/notifications/automation-rules',
        payload,
      );
      setRules(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Erro ao salvar alterações das regras.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (tipo: NotificationAutomationType) => {
    try {
      setResettingTipo(tipo);
      const response = await api.post<NotificationAutomationRule[]>(
        '/api/notifications/automation-rules/reset',
        { tipo },
      );
      const resetRuleData = response.find((r) => r.tipo === tipo);

      setRules((prev) =>
        prev.map((r) => (r.tipo === tipo ? (resetRuleData ?? r) : r)),
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError('Erro ao restaurar regra para o padrão.');
    } finally {
      setResettingTipo(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  if (error && rules.length === 0) {
    return (
      <EmptyState
        title="Erro ao carregar regras"
        description={error}
        action={
          <button
            onClick={loadRules}
            className="px-4 py-2 text-sm font-semibold text-brand-foreground bg-brand rounded-xl hover:bg-brand-hover transition"
          >
            Tentar novamente
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-accent-soft/70 border border-accent-soft-border rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-ink shrink-0" />
            <h3 className="text-base font-bold text-gray-900">
              Automações Inteligentes da Igreja
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-gray-600">
            Personalize os textos, horários de disparo e antecedência dos lembretes automáticos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-brand-foreground bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-xl shadow-xs transition shrink-0 max-sm:w-full"
        >
          {saving && (
            <div className="w-4 h-4 border-2 border-brand-foreground/30 border-t-brand-foreground rounded-full animate-spin" />
          )}
          <span>{saving ? 'Salvando...' : 'Salvar'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Regras de automação atualizadas com sucesso!</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Rules Cards List */}
      <div className="space-y-5">
        {rules.map((rule) => {
          const isResetting = resettingTipo === rule.tipo;

          return (
            <div
              key={rule.tipo}
              className={`border rounded-2xl transition-all ${
                rule.ativo
                  ? 'border-gray-200 bg-white shadow-xs'
                  : 'border-gray-200/60 bg-gray-50/60 opacity-80'
              }`}
            >
              {/* Card Header */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-gray-50 border border-gray-200/80 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                    {RULE_ICONS[rule.tipo] || <Bell className="w-5 h-5 text-gray-500" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-gray-900">{rule.nome}</h4>
                      {rule.isCustom ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-accent-soft text-accent-ink border border-accent-soft-border">
                          Personalizado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600">
                          Padrão do Sistema
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{rule.descricao}</p>
                  </div>
                </div>

                {/* Actions: Reset & Toggle Active / Inactive */}
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleReset(rule.tipo)}
                    disabled={!rule.isCustom || isResetting}
                    title={
                      rule.isCustom
                        ? 'Restaurar esta regra para os textos e horários de fábrica'
                        : 'Esta regra já está utilizando os textos e horários padrão de fábrica'
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      rule.isCustom
                        ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 cursor-pointer shadow-2xs'
                        : 'text-gray-400 bg-gray-50 border border-gray-200 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                    <span>{isResetting ? 'Restaurando...' : 'Restaurar padrão de fábrica'}</span>
                  </button>

                  <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                    <span
                      className={`text-xs font-semibold ${
                        rule.ativo ? 'text-accent-ink' : 'text-gray-400'
                      }`}
                    >
                      {rule.ativo ? 'Ativada' : 'Desativada'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.ativo}
                      onClick={() => handleFieldChange(rule.tipo, 'ativo', !rule.ativo)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-accent-ring focus:ring-offset-2 ${
                        rule.ativo ? 'bg-brand' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-sm ring-0 transition duration-200 ease-in-out ${
                          rule.ativo ? 'translate-x-5 bg-brand-foreground' : 'translate-x-0 bg-white'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Body (Visible when active) */}
              {rule.ativo ? (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Time / Antecedence Controls */}
                    {rule.horario !== null && (
                      <InputField
                        label="Horário de Disparo (Horário de Brasília)"
                        value={rule.horario}
                        onChange={(e) =>
                          handleFieldChange(rule.tipo, 'horario', e.target.value)
                        }
                        placeholder="Ex: 08:00 ou 08:00,13:00"
                        optionalLabel="Formatos aceitos: 08:00 ou múltiplos separados por vírgula"
                      />
                    )}

                    {rule.antecedenciaHoras !== null && (
                      <SelectField
                        label="Antecedência do Lembrete"
                        value={String(rule.antecedenciaHoras)}
                        onChange={(e) =>
                          handleFieldChange(
                            rule.tipo,
                            'antecedenciaHoras',
                            Number(e.target.value),
                          )
                        }
                      >
                        {rule.tipo === 'SCHEDULE_CONFIRMATION_24H' ? (
                          <>
                            <option value="24">24 horas antes do dia do serviço</option>
                            <option value="48">48 horas antes do dia do serviço</option>
                          </>
                        ) : (
                          <>
                            <option value="1">1 hora antes do início</option>
                            <option value="2">2 horas antes do início (Padrão)</option>
                            <option value="3">3 horas antes do início</option>
                            <option value="24">24 horas (1 dia antes)</option>
                          </>
                        )}
                      </SelectField>
                    )}

                    <InputField
                      label="Título da Notificação"
                      value={rule.titulo}
                      onChange={(e) =>
                        handleFieldChange(rule.tipo, 'titulo', e.target.value)
                      }
                      placeholder="Título que aparece no celular"
                    />
                  </div>

                  <TextareaField
                    label="Mensagem da Notificação"
                    rows={3}
                    value={rule.mensagem}
                    onChange={(e) =>
                      handleFieldChange(rule.tipo, 'mensagem', e.target.value)
                    }
                    placeholder="Corpo do texto da notificação..."
                  />

                  {/* Variables Bar */}
                  {rule.variaveisDisponiveis && rule.variaveisDisponiveis.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Variáveis dinâmicas (clique para inserir no texto):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {rule.variaveisDisponiveis.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => insertVariable(rule.tipo, v)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold font-mono rounded-lg border border-accent-soft-border bg-accent-soft/70 text-accent-ink hover:bg-accent-soft transition active:scale-95"
                            title={`Clique para inserir ${v}`}
                          >
                            + {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Smartphone Notification Preview */}
                  <div className="mt-3 p-3.5 bg-gray-900 text-white rounded-xl shadow-xs space-y-1 border border-gray-800">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Prévia no celular do membro
                      </span>
                      <span>Agora</span>
                    </div>
                    <p className="text-xs font-bold text-white leading-tight">
                      {renderPreview(rule.titulo) || 'Título da notificação'}
                    </p>
                    <p className="text-xs text-gray-300 leading-snug">
                      {renderPreview(rule.mensagem) || 'Mensagem da notificação'}
                    </p>
                  </div>

                  {/* Note */}
                  <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-500">
                    {rule.isCustom
                      ? 'Esta regra possui textos personalizados. Use o botão acima para voltar aos padrões de fábrica quando quiser.'
                      : 'Esta regra está operando com os textos e horários recomendados de fábrica.'}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50/70 border-t border-gray-100 text-xs text-gray-500 rounded-b-2xl">
                  <span>Esta regra está desativada. Nenhuma mensagem deste tipo será enviada pela automação.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
