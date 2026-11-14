'use client';

import { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Users,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ModalShell } from './modal-shell';
import { api } from '@/lib/api';

export interface ImportPreviewResponse {
  totalLinhas: number;
  validosCount: number;
  duplicadosCount: number;
  errosCount: number;
  limitePlano: {
    limite: number | null;
    totalAtivos: number;
    disponiveis: number | null;
    excedeuLimite: boolean;
  };
  linhas: Array<{
    linha: number;
    nome: string;
    nomeExibicao?: string;
    whatsapp?: string;
    email?: string;
    dataNascimento?: string;
    sexo?: string;
    estadoCivil?: string;
    cargo?: string;
    dataBatismo?: string;
    cpf?: string;
    rg?: string;
    matricula?: string;
    observacoes?: string;
    statusLinha: 'VALIDO' | 'DUPLICADO' | 'ERRO';
    erros?: string[];
    avisos?: string[];
    camposAlterados?: Array<{
      campo: string;
      label: string;
      anterior?: string | null;
      novo?: string | null;
    }>;
    membroExistenteId?: string;
  }>;
}

export interface ConfirmImportResult {
  totalProcessados: number;
  inseridos: number;
  atualizados: number;
  pulados: number;
}

interface MemberImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'success';
type FilterTab = 'TODOS' | 'VALIDO' | 'DUPLICADO' | 'ERRO';

export function MemberImportModal({ isOpen, onClose, onSuccess }: MemberImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [estrategiaDuplicados, setEstrategiaDuplicados] = useState<'SKIP' | 'UPDATE'>('SKIP');
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>('TODOS');
  const [confirmResult, setConfirmResult] = useState<ConfirmImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function resetState() {
    setStep('upload');
    setFile(null);
    setUploading(false);
    setConfirming(false);
    setError(null);
    setPreview(null);
    setEstrategiaDuplicados('SKIP');
    setActiveFilterTab('TODOS');
    setConfirmResult(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  // 1. Download do modelo oficial .xlsx
  async function handleDownloadTemplate() {
    try {
      setDownloadingTemplate(true);
      setError(null);
      const res = await api.getFile('/api/membros/import/template');
      const blobUrl = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = res.fileName || 'modelo-importacao-membros-oneelo.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setError(err?.message || 'Falha ao baixar planilha modelo.');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  // 2. Upload e validação prévia (Dry-run)
  async function handleFileSelect(selectedFile: File) {
    if (!selectedFile) return;

    const ext = selectedFile.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.csv')) {
      setError('Por favor, selecione um arquivo no formato .xlsx ou .csv.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('O tamanho do arquivo não pode ultrapassar 5 MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const data = await api.post<ImportPreviewResponse>('/api/membros/import/preview', formData);
      setPreview(data);
      setStep('preview');
    } catch (err: any) {
      setError(err?.message || 'Falha ao processar arquivo.');
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  // 3. Confirmação da importação
  async function handleConfirmImport() {
    if (!preview) return;

    setConfirming(true);
    setError(null);

    try {
      const result = await api.post<ConfirmImportResult>('/api/membros/import/confirm', {
        estrategiaDuplicados,
        membros: preview.linhas,
      });

      setConfirmResult(result);
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'Falha ao concluir importação.');
    } finally {
      setConfirming(false);
    }
  }

  const filteredLinhas = (preview?.linhas || []).filter((l) => {
    if (activeFilterTab === 'TODOS') return true;
    return l.statusLinha === activeFilterTab;
  });

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      contentClassName="border border-gray-200 shadow-2xl"
      bodyClassName="p-4 sm:p-6"
      title={
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-accent-ink" />
          <span>Importar Membros via Planilha</span>
        </div>
      }
      description="Cadastre dezenas ou centenas de membros rapidamente importando arquivos Excel (.xlsx) ou CSV."
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-start gap-2.5">
            <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* ── PASSO 1: UPLOAD ───────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-6 py-2">
            {/* Banner para download do modelo */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-accent-soft-border bg-accent-soft/60 p-4.5">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Precisa do modelo padrão?
                </h4>
                <p className="text-xs text-accent-ink">
                  Baixe nossa planilha pré-formatada com as colunas corretas, exemplos e listas suspensas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="w-full sm:w-auto inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-accent-ink border border-accent-soft-border shadow-2xs hover:bg-accent-soft transition-all disabled:opacity-50"
              >
                {downloadingTemplate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Baixar Planilha Modelo (.xlsx)
              </button>
            </div>

            {/* Dropzone de upload */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 p-8 text-center transition-all cursor-pointer hover:border-accent-ring hover:bg-accent-soft/40 ${
                uploading ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink shadow-2xs mb-3">
                {uploading ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <UploadCloud className="h-7 w-7" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">
                  {uploading ? 'Analisando e validando planilha...' : 'Arraste seu arquivo aqui ou clique para selecionar'}
                </p>
                <p className="text-xs text-gray-500">
                  Formatos aceitos: <strong>.XLSX</strong> ou <strong>.CSV</strong> (até 5MB)
                </p>
              </div>
            </div>

            {/* Dicas e Instruções */}
            <div className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-4 space-y-2 text-xs text-gray-600">
              <span className="font-bold text-gray-800 uppercase text-[10px] tracking-wider block">
                Orientações para Importação:
              </span>
              <ul className="list-disc list-inside space-y-1 text-gray-600 leading-relaxed">
                <li>Apenas a coluna <strong>Nome Completo</strong> é estritamente obrigatória.</li>
                <li>Telefones com ou sem DDD serão normalizados automaticamente para o formato WhatsApp.</li>
                <li>Datas de nascimento e batismo podem ser preenchidas como <code>DD/MM/AAAA</code>.</li>
                <li>Campos como Cargo, CPF, RG, Matrícula, Sexo e Estado Civil são identificados e salvos no perfil.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── PASSO 2: PRÉVIA E DIAGNÓSTICO (DRY-RUN) ──────────────── */}
        {step === 'preview' && preview && (
          <div className="space-y-5 py-1">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-3.5 text-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Total de Linhas
                </span>
                <span className="text-xl font-extrabold text-gray-900 mt-0.5 block">
                  {preview.totalLinhas}
                </span>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Novos Válidos
                </span>
                <span className="text-xl font-extrabold text-emerald-700 mt-0.5 block">
                  {preview.validosCount}
                </span>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Duplicados
                </span>
                <span className="text-xl font-extrabold text-amber-700 mt-0.5 block">
                  {preview.duplicadosCount}
                </span>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3.5 text-center">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                  Com Erros
                </span>
                <span className="text-xl font-extrabold text-rose-700 mt-0.5 block">
                  {preview.errosCount}
                </span>
              </div>
            </div>

            {/* Alerta de Limite do Plano */}
            {preview.limitePlano.excedeuLimite && (
              <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-bold">Limite do plano excedido!</strong>
                  <p>
                    Seu plano atual permite até <strong>{preview.limitePlano.limite} membros</strong> e você já possui{' '}
                    <strong>{preview.limitePlano.totalAtivos} ativos</strong>. A importação de{' '}
                    <strong>{preview.validosCount} novos membros</strong> ultrapassa a capacidade.
                  </p>
                  <p className="font-semibold text-rose-800 pt-1">
                    Faça upgrade para o plano Profissional para importar membros ilimitados.
                  </p>
                </div>
              </div>
            )}

            {/* Opções de Estratégia de Duplicidade */}
            {preview.duplicadosCount > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                  Como tratar os {preview.duplicadosCount} membros duplicados encontrados?
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      estrategiaDuplicados === 'SKIP'
                        ? 'border-accent-ink bg-accent-soft/50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="estrategia"
                      value="SKIP"
                      checked={estrategiaDuplicados === 'SKIP'}
                      onChange={() => setEstrategiaDuplicados('SKIP')}
                      className="mt-0.5 accent-accent-ring text-accent-ink focus:ring-accent-ring"
                    />
                    <div>
                      <strong className="font-bold text-gray-900 block">Pular duplicados (Recomendado)</strong>
                      <span className="text-gray-500">Mantém os membros atuais sem alterar seus dados.</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      estrategiaDuplicados === 'UPDATE'
                        ? 'border-accent-ink bg-accent-soft/50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="estrategia"
                      value="UPDATE"
                      checked={estrategiaDuplicados === 'UPDATE'}
                      onChange={() => setEstrategiaDuplicados('UPDATE')}
                      className="mt-0.5 accent-accent-ring text-accent-ink focus:ring-accent-ring"
                    />
                    <div>
                      <strong className="font-bold text-gray-900 block">Atualizar cadastros existentes</strong>
                      <span className="text-gray-500">Sobrescreve os dados do membro com os da planilha.</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Tabs de Filtro da Tabela */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {[
                  { id: 'TODOS', label: `Todos (${preview.totalLinhas})` },
                  { id: 'VALIDO', label: `Válidos (${preview.validosCount})` },
                  { id: 'DUPLICADO', label: `Duplicados (${preview.duplicadosCount})` },
                  { id: 'ERRO', label: `Com Erros (${preview.errosCount})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveFilterTab(t.id as FilterTab)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      activeFilterTab === t.id
                        ? 'bg-brand text-brand-foreground shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-gray-400">
                Mostrando {filteredLinhas.length} registros
              </span>
            </div>

            {/* Tabela de Pré-visualização das Linhas */}
            <div className="max-h-60 overflow-y-auto overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-2xs">
              <table className="min-w-[620px] w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-2.5 px-3.5 w-12 text-center">Linha</th>
                    <th className="py-2.5 px-3.5">Nome</th>
                    <th className="py-2.5 px-3.5">Contato</th>
                    <th className="py-2.5 px-3.5">Cargo / Rol</th>
                    <th className="py-2.5 px-3.5 w-28 text-center">Status</th>
                    <th className="py-2.5 px-3.5">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {filteredLinhas.map((item) => (
                    <tr key={item.linha} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors">
                      <td className="py-2.5 px-3.5 text-center text-gray-400 font-mono text-[11px]">
                        {item.linha}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-gray-900 truncate max-w-[150px]">
                        {item.nome || <span className="text-rose-500 italic">Ausente</span>}
                      </td>
                      <td className="py-2.5 px-3.5 text-gray-600 truncate max-w-[150px]">
                        {item.whatsapp || item.email || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-gray-500 truncate max-w-[120px]">
                        {item.cargo || item.matricula || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        {item.statusLinha === 'VALIDO' && (
                          <span className="inline-block rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                            Válido
                          </span>
                        )}
                        {item.statusLinha === 'DUPLICADO' && (
                          <span className="inline-block rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">
                            Duplicado
                          </span>
                        )}
                        {item.statusLinha === 'ERRO' && (
                          <span className="inline-block rounded-md bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold">
                            Erro
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-[11px]">
                        {item.erros && item.erros.length > 0 && (
                          <span className="text-rose-600 block">{item.erros.join(', ')}</span>
                        )}
                        {item.statusLinha === 'DUPLICADO' && (
                          <div className="space-y-1">
                            {item.camposAlterados && item.camposAlterados.length > 0 ? (
                              <div>
                                <span className="font-semibold text-amber-800 block text-[10px]">
                                  {item.camposAlterados.length} campo(s) alterado(s):
                                </span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {item.camposAlterados.map((ch, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200"
                                      title={ch.anterior ? `Anterior: ${ch.anterior} → Novo: ${ch.novo}` : `Novo valor: ${ch.novo}`}
                                    >
                                      <span className="text-amber-700">{ch.label}:</span>
                                      <strong className="font-bold text-amber-950 truncate max-w-[130px]">{ch.novo}</strong>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 block text-[10px]">
                                Dados idênticos (sem alterações)
                              </span>
                            )}
                          </div>
                        )}
                        {item.avisos && item.avisos.length > 0 && item.statusLinha !== 'DUPLICADO' && (
                          <span className="text-amber-600 block">{item.avisos.join(', ')}</span>
                        )}
                        {!item.erros && !item.avisos && item.statusLinha === 'VALIDO' && (
                          <span className="text-gray-400">Pronto para importar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ações do Rodapé do Passo 2 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={confirming}
                className="w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Escolher Outro Arquivo
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={
                  confirming ||
                  preview.limitePlano.excedeuLimite ||
                  (preview.validosCount === 0 && (preview.duplicadosCount === 0 || estrategiaDuplicados === 'SKIP'))
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-brand-foreground shadow-2xs hover:bg-brand-hover transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gravando Membros no Banco...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    Confirmar e Importar (
                    {estrategiaDuplicados === 'UPDATE'
                      ? preview.validosCount + preview.duplicadosCount
                      : preview.validosCount}{' '}
                    membros)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── PASSO 3: CONCLUSÃO / SUCESSO ─────────────────────────── */}
        {step === 'success' && confirmResult && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-2xs">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-gray-900">
                Importação Concluída com Sucesso!
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Os registros foram salvos e já estão disponíveis na gestão de membros da sua igreja.
              </p>
            </div>

            {/* Resumo em cards */}
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Inseridos</span>
                <span className="text-lg font-black text-emerald-800">{confirmResult.inseridos}</span>
              </div>
              <div className="rounded-xl border border-accent-soft-border bg-accent-soft/70 p-3 text-center">
                <span className="text-[10px] font-bold text-accent-ink uppercase block">Atualizados</span>
                <span className="text-lg font-black text-slate-900">{confirmResult.atualizados}</span>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Pulados</span>
                <span className="text-lg font-black text-gray-700">{confirmResult.pulados}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  handleClose();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-xs font-bold text-brand-foreground shadow-2xs hover:bg-brand-hover transition-all"
              >
                Concluir e Ver Membros
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
