'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  AlertTriangle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { SearchInput } from '@/components/app/search-input';
import { ModalShell, ModalFooter } from '@/components/app/modal-shell';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { InputField, SelectField } from '@/components/app/form-field';
import { Skeleton } from '@/components/app/skeleton';
import { DataTable, Column } from '@/components/app/data-table';
import { useConfiguracaoEscalas } from '@/hooks/use-configuracao-escalas';
import {
  SegmentoCulto,
  CompatibilidadeRegra,
} from '@/types';

export function LiturgiaEscalasSettings() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  const {
    segmentos,
    setSegmentos,
    funcoes,
    compatibilidades,
    loading,
    error,
    setError,
    loadAll,
    createSegmento,
    updateSegmento,
    reorderSegmentos,
    deleteSegmento,
    carregarTemplatePadrao,
    upsertCompatibilidade,
    deleteCompatibilidade,
  } = useConfiguracaoEscalas();

  // ─── Estados de Segmentos ─────────────────────────────────────────────────
  const [addSegmentOpen, setAddSegmentOpen] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [editSegmentTarget, setEditSegmentTarget] = useState<SegmentoCulto | null>(null);
  const [editSegmentName, setEditSegmentName] = useState('');
  const [deleteSegmentTarget, setDeleteSegmentTarget] = useState<SegmentoCulto | null>(null);
  const [segmentLoading, setSegmentLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  // ─── Estados da Matriz ────────────────────────────────────────────────────
  const [ruleSearch, setRuleSearch] = useState('');
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [newRoleAId, setNewRoleAId] = useState('');
  const [newRoleBId, setNewRoleBId] = useState('');
  const [newRuleType, setNewRuleType] = useState<'PERMITIR' | 'AVISAR'>('PERMITIR');
  const [newRuleNotes, setNewRuleNotes] = useState('');
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<CompatibilidadeRegra | null>(null);
  const [editRuleTarget, setEditRuleTarget] = useState<CompatibilidadeRegra | null>(null);
  const [editRuleType, setEditRuleType] = useState<'PERMITIR' | 'AVISAR'>('PERMITIR');
  const [editRuleNotes, setEditRuleNotes] = useState('');
  const [ruleLoading, setRuleLoading] = useState(false);

  // ─── Filtros da Matriz ────────────────────────────────────────────────────
  const filteredCompatibilidades = useMemo(() => {
    if (!ruleSearch.trim()) return compatibilidades;
    const query = ruleSearch.toLowerCase();
    return compatibilidades.filter((r) => {
      const aName = r.funcaoA?.nome.toLowerCase() ?? '';
      const aMin = r.funcaoA?.ministerio?.nome.toLowerCase() ?? '';
      const bName = r.funcaoB?.nome.toLowerCase() ?? '';
      const bMin = r.funcaoB?.ministerio?.nome.toLowerCase() ?? '';
      const notes = r.observacao?.toLowerCase() ?? '';
      return (
        aName.includes(query) ||
        aMin.includes(query) ||
        bName.includes(query) ||
        bMin.includes(query) ||
        notes.includes(query)
      );
    });
  }, [compatibilidades, ruleSearch]);

  // ─── Handlers de Segmentos ────────────────────────────────────────────────
  const handleOpenAddSegment = () => {
    setNewSegmentName('');
    setAddSegmentOpen(true);
  };

  const handleCreateSegment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSegmentName.trim()) return;
    setSegmentLoading(true);
    try {
      await createSegmento(newSegmentName.trim());
      setAddSegmentOpen(false);
      setNewSegmentName('');
    } catch {
      // Error handled by hook
    } finally {
      setSegmentLoading(false);
    }
  };

  const handleOpenEditSegment = (seg: SegmentoCulto) => {
    setEditSegmentTarget(seg);
    setEditSegmentName(seg.nome);
  };

  const handleUpdateSegment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editSegmentTarget || !editSegmentName.trim()) return;
    setSegmentLoading(true);
    try {
      await updateSegmento(editSegmentTarget.id, { nome: editSegmentName.trim() });
      setEditSegmentTarget(null);
    } catch {
      // Error handled by hook
    } finally {
      setSegmentLoading(false);
    }
  };

  const handleMoveSegment = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= segmentos.length) return;
    const reordered = [...segmentos];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setSegmentos(reordered);
    try {
      await reorderSegmentos(reordered.map((s) => s.id));
    } catch {
      // Error handled by hook, fetchSegmentos restores state
    }
  };

  const handleDeleteSegment = async () => {
    if (!deleteSegmentTarget) return;
    setSegmentLoading(true);
    try {
      await deleteSegmento(deleteSegmentTarget.id);
      setDeleteSegmentTarget(null);
    } catch {
      // Error handled by hook
    } finally {
      setSegmentLoading(false);
    }
  };

  const handleLoadTemplate = async () => {
    setTemplateLoading(true);
    try {
      await carregarTemplatePadrao();
    } catch {
      // Error handled by hook
    } finally {
      setTemplateLoading(false);
    }
  };

  // ─── Handlers de Matriz ───────────────────────────────────────────────────
  const handleOpenAddRule = () => {
    setNewRoleAId('');
    setNewRoleBId('');
    setNewRuleType('PERMITIR');
    setNewRuleNotes('');
    setAddRuleOpen(true);
  };

  const handleCreateRule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newRoleAId || !newRoleBId || newRoleAId === newRoleBId) return;
    setRuleLoading(true);
    try {
      await upsertCompatibilidade({
        funcaoAId: newRoleAId,
        funcaoBId: newRoleBId,
        regra: newRuleType,
        observacao: newRuleNotes.trim() || undefined,
      });
      setAddRuleOpen(false);
    } catch {
      // Error handled by hook
    } finally {
      setRuleLoading(false);
    }
  };

  const handleOpenEditRule = (r: CompatibilidadeRegra) => {
    setEditRuleTarget(r);
    setEditRuleType(r.regra);
    setEditRuleNotes(r.observacao || '');
  };

  const handleUpdateRule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editRuleTarget) return;
    setRuleLoading(true);
    try {
      await upsertCompatibilidade({
        funcaoAId: editRuleTarget.funcaoAId,
        funcaoBId: editRuleTarget.funcaoBId,
        regra: editRuleType,
        observacao: editRuleNotes.trim() || undefined,
      });
      setEditRuleTarget(null);
    } catch {
      // Error handled by hook
    } finally {
      setRuleLoading(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRuleTarget) return;
    setRuleLoading(true);
    try {
      await deleteCompatibilidade(deleteRuleTarget.id);
      setDeleteRuleTarget(null);
    } catch {
      // Error handled by hook
    } finally {
      setRuleLoading(false);
    }
  };

  const segmentoColumns = useMemo<Column<SegmentoCulto>[]>(
    () => [
      {
        key: 'ordem',
        header: t('liturgia.segments.order'),
        className: 'w-20 text-center',
        render: (seg) => {
          const idx = segmentos.findIndex((s) => s.id === seg.id);
          return (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-xs font-bold text-gray-700">
              #{idx + 1}
            </span>
          );
        },
      },
      {
        key: 'nome',
        header: t('liturgia.segments.name'),
        render: (seg) => (
          <span className="font-semibold text-gray-900">{seg.nome}</span>
        ),
      },
      {
        key: 'actions',
        header: <span className="sr-only">{tCommon('actions')}</span>,
        className: 'w-44 text-right',
        render: (seg) => {
          const idx = segmentos.findIndex((s) => s.id === seg.id);
          return (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleMoveSegment(idx, 'up')}
                disabled={idx === 0}
                title={t('liturgia.segments.moveUp')}
                aria-label={t('liturgia.segments.moveUp')}
                className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center disabled:opacity-30 disabled:hover:bg-white"
              >
                <ChevronUp className="w-4 h-4 text-gray-500" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveSegment(idx, 'down')}
                disabled={idx === segmentos.length - 1}
                title={t('liturgia.segments.moveDown')}
                aria-label={t('liturgia.segments.moveDown')}
                className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center disabled:opacity-30 disabled:hover:bg-white"
              >
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              <button
                type="button"
                onClick={() => handleOpenEditSegment(seg)}
                title={t('liturgia.segments.edit')}
                aria-label={t('liturgia.segments.edit')}
                className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
              >
                <Pencil className="w-4 h-4 text-indigo-500" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteSegmentTarget(seg)}
                title={t('liturgia.segments.delete')}
                aria-label={t('liturgia.segments.delete')}
                className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 bg-white transition-all flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          );
        },
      },
    ],
    [segmentos, t, tCommon],
  );

  const compatibilidadeColumns = useMemo<Column<CompatibilidadeRegra>[]>(
    () => [
      {
        key: 'funcaoA',
        header: t('liturgia.matrix.roleA'),
        render: (r) => (
          <div>
            <span className="font-semibold text-gray-900 block">
              {r.funcaoA?.nome}
            </span>
            <span className="text-xs text-gray-400">
              {r.funcaoA?.ministerio?.nome}
            </span>
          </div>
        ),
      },
      {
        key: 'funcaoB',
        header: t('liturgia.matrix.roleB'),
        render: (r) => (
          <div>
            <span className="font-semibold text-gray-900 block">
              {r.funcaoB?.nome}
            </span>
            <span className="text-xs text-gray-400">
              {r.funcaoB?.ministerio?.nome}
            </span>
          </div>
        ),
      },
      {
        key: 'regra',
        header: t('liturgia.matrix.rule'),
        render: (r) =>
          r.regra === 'PERMITIR' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              {t('liturgia.matrix.ruleAllowShort')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              {t('liturgia.matrix.ruleWarnShort')}
            </span>
          ),
      },
      {
        key: 'observacao',
        header: t('liturgia.matrix.notes'),
        render: (r) => (
          <span className="text-xs text-gray-500 max-w-xs block truncate">
            {r.observacao || '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: <span className="sr-only">{tCommon('actions')}</span>,
        className: 'w-24 text-right',
        render: (r) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleOpenEditRule(r)}
              title={t('liturgia.matrix.editRule')}
              aria-label={t('liturgia.matrix.editRule')}
              className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
            >
              <Pencil className="w-4 h-4 text-indigo-500" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteRuleTarget(r)}
              title={tCommon('delete')}
              aria-label={tCommon('delete')}
              className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 bg-white transition-all flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ),
      },
    ],
    [t, tCommon],
  );

  if (loading) {
    return (
      <div className="space-y-6 py-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-2xs space-y-4">
          <Skeleton className="h-6 w-48 bg-gray-200" />
          <Skeleton className="h-4 w-96 bg-gray-200" />
          <Skeleton className="h-32 w-full bg-gray-100" />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-2xs space-y-4">
          <Skeleton className="h-6 w-48 bg-gray-200" />
          <Skeleton className="h-4 w-96 bg-gray-200" />
          <Skeleton className="h-32 w-full bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Banner de Erro */}
      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setError(null);
              loadAll();
            }}
            className="underline font-semibold hover:text-red-800 text-xs"
          >
            {tCommon('reload')}
          </button>
        </div>
      )}

      {/* ════════════════ SEÇÃO 1: SEGMENTOS DO CULTO ════════════════ */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {t('liturgia.segments.title')}
            </h3>
            <p className="text-sm text-gray-500">
              {t('liturgia.segments.description')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddSegment}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t('liturgia.segments.add')}</span>
            </button>
          </div>
        </div>

        {segmentos.length === 0 ? (
          <EmptyState
            title={t('liturgia.segments.emptyTitle')}
            description={t('liturgia.segments.emptyDesc')}
            action={
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleLoadTemplate}
                  disabled={templateLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {templateLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{t('liturgia.segments.loadTemplate')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddSegment}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-gray-700 hover:bg-gray-100 font-semibold text-sm rounded-xl transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('liturgia.segments.add')}</span>
                </button>
              </div>
            }
          />
        ) : (
          <DataTable<SegmentoCulto>
            columns={segmentoColumns}
            data={segmentos}
            rowKey="id"
            renderMobileCard={(seg) => {
              const idx = segmentos.findIndex((s) => s.id === seg.id);
              return (
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-xs font-bold text-gray-700 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-gray-900 truncate text-sm">{seg.nome}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveSegment(idx, 'up')}
                      disabled={idx === 0}
                      title={t('liturgia.segments.moveUp')}
                      aria-label={t('liturgia.segments.moveUp')}
                      className="p-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSegment(idx, 'down')}
                      disabled={idx === segmentos.length - 1}
                      title={t('liturgia.segments.moveDown')}
                      aria-label={t('liturgia.segments.moveDown')}
                      className="p-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditSegment(seg)}
                      title={t('liturgia.segments.edit')}
                      aria-label={t('liturgia.segments.edit')}
                      className="p-1.5 border border-gray-200 hover:border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-indigo-500 flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4 text-indigo-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteSegmentTarget(seg)}
                      title={t('liturgia.segments.delete')}
                      aria-label={t('liturgia.segments.delete')}
                      className="p-1.5 border border-red-100 hover:bg-red-50 rounded-lg text-red-500 bg-white flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              );
            }}
          />
        )}
      </section>

      {/* ════════════════ SEÇÃO 2: MATRIZ DE COMPATIBILIDADE ════════════════ */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {t('liturgia.matrix.title')}
            </h3>
            <p className="text-sm text-gray-500">
              {t('liturgia.matrix.description')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddRule}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{t('liturgia.matrix.addRule')}</span>
          </button>
        </div>

        {/* Busca na Matriz */}
        <SearchInput
          value={ruleSearch}
          onChange={setRuleSearch}
          placeholder={t('liturgia.matrix.searchPlaceholder')}
        />

        {compatibilidades.length === 0 ? (
          <EmptyState
            title={t('liturgia.matrix.emptyTitle')}
            description={t('liturgia.matrix.emptyDesc')}
            action={
              <button
                type="button"
                onClick={handleOpenAddRule}
                className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{t('liturgia.matrix.addRule')}</span>
              </button>
            }
          />
        ) : (
          <DataTable<CompatibilidadeRegra>
            columns={compatibilidadeColumns}
            data={filteredCompatibilidades}
            rowKey="id"
            emptyTitle={tCommon('noResults')}
            emptyDescription="Nenhuma regra de compatibilidade encontrada com os termos pesquisados."
            renderMobileCard={(r) => (
              <div className="p-3.5 sm:p-4 space-y-3">
                {/* Barra Superior: Badge da Regra + Ações */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    {r.regra === 'PERMITIR' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3.5 h-3.5" />
                        {t('liturgia.matrix.ruleAllow')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {t('liturgia.matrix.ruleWarn')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditRule(r)}
                      title={t('liturgia.matrix.editRule')}
                      aria-label={t('liturgia.matrix.editRule')}
                      className="p-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-indigo-600 bg-white hover:bg-gray-50 transition-all flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4 text-indigo-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteRuleTarget(r)}
                      title={tCommon('delete')}
                      aria-label={tCommon('delete')}
                      className="p-1.5 border border-red-100 hover:bg-red-50 rounded-lg text-red-500 bg-white transition-all flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Box de Funções A e B */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-gray-50 border border-gray-150 rounded-xl p-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      {t('liturgia.matrix.roleA')}
                    </span>
                    <p className="text-sm font-bold text-gray-900 truncate mt-0.5">
                      {r.funcaoA?.nome}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {r.funcaoA?.ministerio?.nome}
                    </p>
                  </div>
                  <div className="min-w-0 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-gray-200 sm:pl-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      {t('liturgia.matrix.roleB')}
                    </span>
                    <p className="text-sm font-bold text-gray-900 truncate mt-0.5">
                      {r.funcaoB?.nome}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {r.funcaoB?.ministerio?.nome}
                    </p>
                  </div>
                </div>

                {/* Observação (se houver) */}
                {r.observacao && (
                  <div className="bg-amber-50/50 border border-amber-100/80 rounded-xl p-2.5 text-xs text-gray-600">
                    <span className="font-semibold text-amber-900 block mb-0.5">{t('liturgia.matrix.notes')}:</span>
                    <span>{r.observacao}</span>
                  </div>
                )}
              </div>
            )}
          />
        )}
      </section>

      {/* ════════════════ MODAIS ════════════════ */}

      {/* Modal: Adicionar Segmento */}
      <ModalShell
        isOpen={addSegmentOpen}
        title={t('liturgia.segments.add')}
        onClose={() => setAddSegmentOpen(false)}
        size="sm"
        footer={
          <ModalFooter
            primaryLabel={t('liturgia.segments.add')}
            onCancel={() => setAddSegmentOpen(false)}
            form="add-segment-form"
            loading={segmentLoading}
            disabled={!newSegmentName.trim()}
          />
        }
      >
        <form id="add-segment-form" onSubmit={handleCreateSegment} className="space-y-4 p-4 sm:p-6">
          <InputField
            id="new-segment-name"
            label={t('liturgia.segments.name')}
            value={newSegmentName}
            onChange={(e) => setNewSegmentName(e.target.value)}
            placeholder={t('liturgia.segments.namePlaceholder')}
            autoFocus
            required
          />
        </form>
      </ModalShell>

      {/* Modal: Editar Segmento */}
      <ModalShell
        isOpen={!!editSegmentTarget}
        title={t('liturgia.segments.edit')}
        onClose={() => setEditSegmentTarget(null)}
        size="sm"
        footer={
          <ModalFooter
            primaryLabel={tCommon('save')}
            onCancel={() => setEditSegmentTarget(null)}
            form="edit-segment-form"
            loading={segmentLoading}
            disabled={!editSegmentName.trim()}
          />
        }
      >
        <form id="edit-segment-form" onSubmit={handleUpdateSegment} className="space-y-4 p-4 sm:p-6">
          <InputField
            id="edit-segment-name"
            label={t('liturgia.segments.name')}
            value={editSegmentName}
            onChange={(e) => setEditSegmentName(e.target.value)}
            autoFocus
            required
          />
        </form>
      </ModalShell>

      {/* ConfirmDialog: Excluir Segmento */}
      <ConfirmDialog
        isOpen={!!deleteSegmentTarget}
        title={t('liturgia.segments.deleteTitle')}
        description={t('liturgia.segments.deleteConfirm', {
          name: deleteSegmentTarget?.nome ?? '',
        })}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        loading={segmentLoading}
        variant="danger"
        onConfirm={handleDeleteSegment}
        onCancel={() => setDeleteSegmentTarget(null)}
      />

      {/* Modal: Adicionar Regra de Compatibilidade */}
      <ModalShell
        isOpen={addRuleOpen}
        title={t('liturgia.matrix.addRule')}
        description={t('liturgia.matrix.description')}
        onClose={() => setAddRuleOpen(false)}
        size="md"
        footer={
          <ModalFooter
            primaryLabel={tCommon('save')}
            onCancel={() => setAddRuleOpen(false)}
            form="add-rule-form"
            loading={ruleLoading}
            disabled={!newRoleAId || !newRoleBId || newRoleAId === newRoleBId}
          />
        }
      >
        <form id="add-rule-form" onSubmit={handleCreateRule} className="space-y-4 p-4 sm:p-6">
          <SelectField
            id="new-rule-role-a"
            label={t('liturgia.matrix.roleA')}
            value={newRoleAId}
            onChange={(e) => {
              setNewRoleAId(e.target.value);
              if (e.target.value === newRoleBId) setNewRoleBId('');
            }}
            required
          >
            <option value="">{t('liturgia.matrix.selectRoleA')}</option>
            {funcoes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ministerio?.nome} — {f.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="new-rule-role-b"
            label={t('liturgia.matrix.roleB')}
            value={newRoleBId}
            onChange={(e) => setNewRoleBId(e.target.value)}
            disabled={!newRoleAId}
            required
          >
            <option value="">{t('liturgia.matrix.selectRoleB')}</option>
            {funcoes
              .filter((f) => f.id !== newRoleAId)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.ministerio?.nome} — {f.nome}
                </option>
              ))}
          </SelectField>

          <SelectField
            id="new-rule-type"
            label={t('liturgia.matrix.rule')}
            value={newRuleType}
            onChange={(e) => setNewRuleType(e.target.value as 'PERMITIR' | 'AVISAR')}
          >
            <option value="PERMITIR">{t('liturgia.matrix.ruleAllow')}</option>
            <option value="AVISAR">{t('liturgia.matrix.ruleWarn')}</option>
          </SelectField>

          <InputField
            id="new-rule-notes"
            label={t('liturgia.matrix.notes')}
            optionalLabel={`(${tCommon('optional')})`}
            value={newRuleNotes}
            onChange={(e) => setNewRuleNotes(e.target.value)}
            placeholder={t('liturgia.matrix.notesPlaceholder')}
          />
        </form>
      </ModalShell>

      {/* ConfirmDialog: Excluir Regra de Compatibilidade */}
      <ConfirmDialog
        isOpen={!!deleteRuleTarget}
        title={t('liturgia.matrix.deleteRuleTitle')}
        description={t('liturgia.matrix.deleteRuleConfirm', {
          roleA: deleteRuleTarget?.funcaoA?.nome ?? '',
          roleB: deleteRuleTarget?.funcaoB?.nome ?? '',
        })}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        loading={ruleLoading}
        variant="danger"
        onConfirm={handleDeleteRule}
        onCancel={() => setDeleteRuleTarget(null)}
      />

      {/* Modal: Editar Regra de Compatibilidade */}
      <ModalShell
        isOpen={!!editRuleTarget}
        title={t('liturgia.matrix.editRuleTitle')}
        description={t('liturgia.matrix.editRuleDescription')}
        onClose={() => setEditRuleTarget(null)}
        size="md"
        footer={
          <ModalFooter
            primaryLabel={tCommon('save')}
            onCancel={() => setEditRuleTarget(null)}
            form="edit-rule-form"
            loading={ruleLoading}
          />
        }
      >
        <form id="edit-rule-form" onSubmit={handleUpdateRule} className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-gray-50 border border-gray-150 rounded-xl">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
                {t('liturgia.matrix.roleA')}
              </span>
              <span className="text-sm font-bold text-gray-900 block mt-0.5">
                {editRuleTarget?.funcaoA?.nome}
              </span>
              <span className="text-xs text-gray-500">
                {editRuleTarget?.funcaoA?.ministerio?.nome}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
                {t('liturgia.matrix.roleB')}
              </span>
              <span className="text-sm font-bold text-gray-900 block mt-0.5">
                {editRuleTarget?.funcaoB?.nome}
              </span>
              <span className="text-xs text-gray-500">
                {editRuleTarget?.funcaoB?.ministerio?.nome}
              </span>
            </div>
          </div>

          <SelectField
            id="edit-rule-type"
            label={t('liturgia.matrix.rule')}
            value={editRuleType}
            onChange={(e) => setEditRuleType(e.target.value as 'PERMITIR' | 'AVISAR')}
          >
            <option value="PERMITIR">{t('liturgia.matrix.ruleAllow')}</option>
            <option value="AVISAR">{t('liturgia.matrix.ruleWarn')}</option>
          </SelectField>

          <InputField
            id="edit-rule-notes"
            label={t('liturgia.matrix.notes')}
            optionalLabel={`(${tCommon('optional')})`}
            value={editRuleNotes}
            onChange={(e) => setEditRuleNotes(e.target.value)}
            placeholder={t('liturgia.matrix.notesPlaceholder')}
          />
        </form>
      </ModalShell>
    </div>
  );
}
