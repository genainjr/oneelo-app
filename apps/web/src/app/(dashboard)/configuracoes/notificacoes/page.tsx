"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BellOff,
  Plus,
  RefreshCw,
  Eye,
  Send,
  Calendar,
  Users,
  Building,
  RotateCcw,
  Edit2,
  Ban,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { DataTable, Column } from "@/components/app/data-table";
import { FilterActions, FilterShell } from "@/components/app/filter-shell";
import { FilterInput, FilterSelect } from "@/components/app/filter-field";
import { useFilterState } from "@/hooks/use-filter-state";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { ModalShell, ModalError } from "@/components/app/modal-shell";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { InputField, SelectField, TextareaField } from "@/components/app/form-field";
import { useAuthUser } from "@/contexts/auth-user-context";
import { api, buildQuery } from "@/lib/api";
import { useDateFormatter } from "@/hooks/use-date-formatter";
import type {
  NotificationItem,
  NotificationListResponse,
  NotificationDetailResponse,
  NotificationStatus,
  NotificationOrigin,
  NotificationAudienceType,
  RecipientDeliveryStatus,
} from "@/types";

interface NotificationFilterState {
  search: string;
  status: "" | NotificationStatus;
  origem: "" | NotificationOrigin;
  tipoPublico: "" | NotificationAudienceType;
}

const EMPTY_FILTERS: NotificationFilterState = {
  search: "",
  status: "",
  origem: "",
  tipoPublico: "",
};

const STATUS_CONFIG: Record<
  NotificationStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Na Fila",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  SCHEDULED: {
    label: "Agendada",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  PROCESSING: {
    label: "Processando",
    className: "bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse",
  },
  COMPLETED: {
    label: "Concluída",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  FAILED: {
    label: "Falha",
    className: "bg-rose-50 text-rose-700 border border-rose-200",
  },
  CANCELED: {
    label: "Cancelada",
    className: "bg-gray-100 text-gray-500 border border-gray-200 line-through",
  },
};

const ORIGIN_LABELS: Record<NotificationOrigin, string> = {
  SYSTEM_AUTOMATION: "Automação do Sistema",
  COMMUNICATION_GENERAL: "Comunicado Geral",
  COMMUNICATION_MINISTRY: "Comunicado Ministerial",
};

const AUDIENCE_LABELS: Record<NotificationAudienceType, string> = {
  ALL_MEMBERS: "Todos os Membros",
  MINISTRY: "Ministério",
  SPECIFIC_USERS: "Usuários Específicos",
};

const RECIPIENT_STATUS_CONFIG: Record<
  RecipientDeliveryStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pendente",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  PROCESSING: {
    label: "Enviando...",
    className: "bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse",
  },
  SENT: {
    label: "Entregue",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  FAILED_RETRYABLE: {
    label: "Falha Temporária",
    className: "bg-rose-50 text-rose-700 border border-rose-200",
  },
  FAILED_PERMANENT: {
    label: "Falha Definitiva",
    className: "bg-red-100 text-red-800 border border-red-300",
  },
  NO_SUBSCRIPTION: {
    label: "Sem Inscrição",
    className: "bg-gray-100 text-gray-600 border border-gray-200",
  },
};

export default function CentralNotificacoesPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const { formatDateTime } = useDateFormatter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [metrics, setMetrics] = useState({
    totalSent: 0,
    totalPending: 0,
    totalFailed: 0,
    totalNoSubscription: 0,
  });

  // Modal de Detalhes
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<NotificationDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [recipientPage, setRecipientPage] = useState(1);

  // Modal de Criação / Edição Manual
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [ministerios, setMinisterios] = useState<Array<{ id: string; nome: string }>>([]);
  const [createForm, setCreateForm] = useState({
    titulo: "",
    mensagem: "",
    urlDestino: "/personal-panel",
    tipoPublico: "ALL_MEMBERS" as NotificationAudienceType,
    ministerioId: "",
    isScheduled: false,
    scheduledAt: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Diálogo de Confirmação de Cancelamento
  const [cancelingItem, setCancelingItem] = useState<{ id: string; titulo: string } | null>(null);
  const [cancelingLoading, setCancelingLoading] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState<NotificationFilterState>(EMPTY_FILTERS);

  const {
    formState,
    setField,
    handleClear,
    handleSubmit,
  } = useFilterState<NotificationFilterState>({
    initialState: EMPTY_FILTERS,
    autoApply: true,
    debounceFields: ["search"],
    onApply: (nextFilters) => {
      setAppliedFilters(nextFilters);
      setCurrentPage(1);
    },
  });

  const loadNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const query = buildQuery({
        page: currentPage,
        limit: 15,
        search: appliedFilters.search || undefined,
        status: appliedFilters.status || undefined,
        origem: appliedFilters.origem || undefined,
        tipoPublico: appliedFilters.tipoPublico || undefined,
      });

      const response = await api.get<NotificationListResponse>(
        `/api/notifications${query}`,
      );
      setItems(response.data);
      setTotal(response.meta.total);
      if (response.metrics) {
        setMetrics(response.metrics);
      }
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentPage, appliedFilters]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Polling automático suave enquanto houver notificações em processamento, pendentes ou agendadas prontas para envio
  useEffect(() => {
    const now = Date.now();
    const hasActiveItems = items.some((item) => {
      if (item.status === "PENDING" || item.status === "PROCESSING") return true;
      if (item.status === "SCHEDULED") {
        const schedTime = new Date(item.scheduledAt).getTime();
        return schedTime <= now + 60000;
      }
      return false;
    });

    if (!hasActiveItems) return;

    const interval = setInterval(() => {
      loadNotifications(true);
    }, 3500);

    return () => clearInterval(interval);
  }, [items, loadNotifications]);

  const loadMinisterios = useCallback(async () => {
    try {
      const res = await api.get<Array<{ id: string; nome: string }>>("/api/ministerios");
      setMinisterios(res);
    } catch {
      // Ignora erro ao carregar ministérios
    }
  }, []);

  const openDetailModal = async (id: string, page = 1) => {
    setSelectedNotificationId(id);
    setRecipientPage(page);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await api.get<NotificationDetailResponse>(
        `/api/notifications/${id}?page=${page}&limit=10`,
      );
      setDetailData(res);
    } catch (error) {
      console.error("Erro ao carregar detalhes da notificação:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshDetailModal = useCallback(async (id: string, page = 1) => {
    try {
      const res = await api.get<NotificationDetailResponse>(
        `/api/notifications/${id}?page=${page}&limit=10`,
      );
      setDetailData(res);
    } catch (error) {
      console.error("Erro ao atualizar detalhes da notificação:", error);
    }
  }, []);

  // Polling suave no modal de auditoria se houver destinatários sendo processados
  useEffect(() => {
    if (!detailModalOpen || !selectedNotificationId || !detailData) return;
    const isOngoing =
      detailData.notification.status === "PENDING" ||
      detailData.notification.status === "PROCESSING" ||
      detailData.stats.pending > 0;

    if (!isOngoing) return;

    const interval = setInterval(() => {
      refreshDetailModal(selectedNotificationId, recipientPage);
    }, 3500);

    return () => clearInterval(interval);
  }, [detailModalOpen, selectedNotificationId, detailData, recipientPage, refreshDetailModal]);

  const handleRetryFailed = async () => {
    if (!selectedNotificationId) return;
    try {
      setRetrying(true);
      await api.post(`/api/notifications/${selectedNotificationId}/retry`);
      await openDetailModal(selectedNotificationId, recipientPage);
      await loadNotifications();
    } catch (error) {
      console.error("Erro ao retentar envios com falha:", error);
    } finally {
      setRetrying(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setCreateForm({
      titulo: "",
      mensagem: "",
      urlDestino: "/personal-panel",
      tipoPublico: "ALL_MEMBERS",
      ministerioId: "",
      isScheduled: false,
      scheduledAt: "",
    });
    setCreateError(null);
    setCreateModalOpen(true);
    loadMinisterios();
  };

  const openEditModal = (item: NotificationItem) => {
    setEditingId(item.id);
    let schedDate = "";
    if (item.scheduledAt) {
      const d = new Date(item.scheduledAt);
      // Ajuste local para datetime-local (YYYY-MM-DDTHH:mm)
      const tzOffset = d.getTimezoneOffset() * 60000;
      schedDate = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    }
    setCreateForm({
      titulo: item.titulo,
      mensagem: item.mensagem,
      urlDestino: item.urlDestino || "/personal-panel",
      tipoPublico: item.tipoPublico,
      ministerioId: item.ministerio?.id || "",
      isScheduled: Boolean(item.scheduledAt),
      scheduledAt: schedDate,
    });
    setCreateError(null);
    setCreateModalOpen(true);
  };

  const requestCancelNotification = (id: string, titulo: string) => {
    setCancelingItem({ id, titulo });
  };

  const handleConfirmCancel = async () => {
    if (!cancelingItem) return;
    try {
      setCancelingLoading(true);
      await api.post(`/api/notifications/${cancelingItem.id}/cancel`);
      setCancelingItem(null);
      if (detailModalOpen && selectedNotificationId === cancelingItem.id) {
        setDetailModalOpen(false);
      }
      await loadNotifications(true);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Erro ao cancelar notificação.";
      alert(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setCancelingLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createForm.titulo.trim()) {
      setCreateError("O título é obrigatório.");
      return;
    }
    if (!createForm.mensagem.trim()) {
      setCreateError("A mensagem é obrigatória.");
      return;
    }
    if (!editingId && createForm.tipoPublico === "MINISTRY" && !createForm.ministerioId) {
      setCreateError("Selecione o ministério de destino.");
      return;
    }
    if (createForm.isScheduled && !createForm.scheduledAt) {
      setCreateError("Selecione a data e hora do agendamento.");
      return;
    }

    try {
      setCreating(true);

      if (editingId) {
        await api.patch(`/api/notifications/${editingId}`, {
          titulo: createForm.titulo.trim(),
          mensagem: createForm.mensagem.trim(),
          urlDestino: createForm.urlDestino?.trim() || "/personal-panel",
          scheduledAt:
            createForm.isScheduled && createForm.scheduledAt
              ? new Date(createForm.scheduledAt).toISOString()
              : undefined,
        });
      } else {
        await api.post("/api/notifications/manual", {
          titulo: createForm.titulo.trim(),
          mensagem: createForm.mensagem.trim(),
          urlDestino: createForm.urlDestino?.trim() || "/personal-panel",
          tipoPublico: createForm.tipoPublico,
          ministerioId:
            createForm.tipoPublico === "MINISTRY"
              ? createForm.ministerioId
              : undefined,
          scheduledAt:
            createForm.isScheduled && createForm.scheduledAt
              ? new Date(createForm.scheduledAt).toISOString()
              : undefined,
        });
      }

      setCreateModalOpen(false);
      setEditingId(null);
      await loadNotifications();
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.message ||
        (editingId ? "Erro ao atualizar comunicado." : "Erro ao criar comunicado.");
      setCreateError(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setCreating(false);
    }
  };

  const columns: Column<NotificationItem>[] = [
    {
      key: "titulo",
      header: "Notificação / Comunicado",
      render: (item) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 line-clamp-1">
              {item.titulo}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {ORIGIN_LABELS[item.origem] || item.origem}
            </span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-1">{item.mensagem}</p>
        </div>
      ),
    },
    {
      key: "publico",
      header: "Público Alvo",
      hideOnMobile: true,
      render: (item) => (
        <div className="text-xs text-gray-700">
          <p className="font-medium">
            {AUDIENCE_LABELS[item.tipoPublico] || item.tipoPublico}
          </p>
          {item.ministerio && (
            <p className="text-gray-500 text-[11px] flex items-center gap-1 mt-0.5">
              <Building className="w-3 h-3 text-gray-400" />
              {item.ministerio.nome}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "scheduledAt",
      header: "Agendamento / Envio",
      hideOnMobile: true,
      render: (item) => (
        <div className="text-xs text-gray-600 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>{formatDateTime(new Date(item.scheduledAt))}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => {
        const conf = STATUS_CONFIG[item.status] || {
          label: item.status,
          className: "bg-gray-100 text-gray-700",
        };
        return <StatusBadge label={conf.label} className={conf.className} />;
      },
    },
    {
      key: "entregas",
      header: "Entregas Web Push",
      render: (item) => {
        const stats = item.deliveryStats || {
          total: 0,
          sent: 0,
          pending: 0,
          failed: 0,
          noSubscription: 0,
        };
        const successRate =
          stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;

        return (
          <div className="space-y-1 min-w-[130px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700">
                {stats.sent} / {stats.total}
              </span>
              <span className="text-[10px] text-gray-400">{successRate}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${(stats.sent / (stats.total || 1)) * 100}%` }}
                className="bg-emerald-500 h-full"
              />
              <div
                style={{
                  width: `${(stats.failed / (stats.total || 1)) * 100}%`,
                }}
                className="bg-rose-500 h-full"
              />
              <div
                style={{
                  width: `${(stats.noSubscription / (stats.total || 1)) * 100}%`,
                }}
                className="bg-gray-300 h-full"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              {stats.failed > 0 && (
                <span className="text-rose-600 font-medium">
                  {stats.failed} falha{stats.failed > 1 ? "s" : ""}
                </span>
              )}
              {stats.noSubscription > 0 && (
                <span>{stats.noSubscription} sem push</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "acoes",
      header: "",
      className: "text-right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          {item.status === "SCHEDULED" && (
            <>
              <button
                onClick={() => openEditModal(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                title="Editar agendamento"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </button>
              <button
                onClick={() => requestCancelNotification(item.id, item.titulo)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                title="Cancelar agendamento"
              >
                <Ban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cancelar</span>
              </button>
            </>
          )}
          <button
            onClick={() => openDetailModal(item.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition"
            title="Ver detalhes de entrega"
          >
            <Eye className="w-3.5 h-3.5 text-gray-500" />
            <span>Detalhes</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Central de Notificações"
        description="Histórico, auditoria de entregas e comunicados manuais com Web Push."
        stackActionsOnMobile
        action={
          <div className="flex items-center gap-2 max-sm:w-full">
            <button
              type="button"
              onClick={() => loadNotifications(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-sm transition disabled:opacity-60"
              title="Atualizar lista"
            >
              <RotateCcw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition max-sm:w-full max-sm:justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Comunicado</span>
            </button>
          </div>
        }
      />

      {/* Métricas Globais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Enviadas com Sucesso"
          value={metrics.totalSent}
          color="emerald"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          title="Na Fila / Pendentes"
          value={metrics.totalPending}
          color="blue"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="Falhas de Entrega"
          value={metrics.totalFailed}
          color="rose"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <StatCard
          title="Sem Inscrição Web Push"
          value={metrics.totalNoSubscription}
          color="amber"
          icon={<BellOff className="w-5 h-5" />}
        />
      </div>

      {/* Filtros Padronizados */}
      <FilterShell
        onSubmit={handleSubmit}
        actions={
          <FilterActions
            clearLabel="Limpar"
            reloadLabel="Recarregar"
            onClear={handleClear}
            onReload={loadNotifications}
          />
        }
      >
        <FilterInput
          id="search"
          label="Buscar por título ou mensagem"
          placeholder="Ex: Culto de Domingo, Escala..."
          value={formState.search}
          onChange={(e) => setField("search", e.target.value)}
        />
        <FilterSelect
          id="status"
          label="Status"
          value={formState.status}
          onChange={(e) =>
            setField("status", e.target.value as NotificationStatus)
          }
        >
          <option value="">Todos os status</option>
          <option value="PENDING">Na Fila</option>
          <option value="SCHEDULED">Agendada</option>
          <option value="PROCESSING">Processando</option>
          <option value="COMPLETED">Concluída</option>
          <option value="FAILED">Falha</option>
          <option value="CANCELED">Cancelada</option>
        </FilterSelect>
        <FilterSelect
          id="origem"
          label="Origem"
          value={formState.origem}
          onChange={(e) =>
            setField("origem", e.target.value as NotificationOrigin)
          }
        >
          <option value="">Todas as origens</option>
          <option value="SYSTEM_AUTOMATION">Automação do Sistema</option>
          <option value="COMMUNICATION_GENERAL">Comunicado Geral</option>
          <option value="COMMUNICATION_MINISTRY">Comunicado Ministerial</option>
        </FilterSelect>
        <FilterSelect
          id="tipoPublico"
          label="Público"
          value={formState.tipoPublico}
          onChange={(e) =>
            setField("tipoPublico", e.target.value as NotificationAudienceType)
          }
        >
          <option value="">Todos os públicos</option>
          <option value="ALL_MEMBERS">Todos os Membros</option>
          <option value="MINISTRY">Ministério</option>
          <option value="SPECIFIC_USERS">Usuários Específicos</option>
        </FilterSelect>
      </FilterShell>

      {/* Listagem */}
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        rowKey="id"
        currentPage={currentPage}
        totalItems={total}
        itemsPerPage={15}
        onPageChange={(page) => setCurrentPage(page)}
        emptyTitle="Nenhuma notificação encontrada"
        emptyDescription="Não há registros correspondentes aos filtros selecionados."
        renderMobileCard={(item) => (
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">
                  {item.titulo}
                </h4>
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                  {item.mensagem}
                </p>
              </div>
              <StatusBadge
                label={STATUS_CONFIG[item.status]?.label || item.status}
                className={STATUS_CONFIG[item.status]?.className}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
              <span>{formatDateTime(new Date(item.scheduledAt))}</span>
              <button
                onClick={() => openDetailModal(item.id)}
                className="text-indigo-600 font-medium hover:underline flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                Detalhes
              </button>
            </div>
          </div>
        )}
      />

      {/* Modal de Detalhes e Auditoria */}
      <ModalShell
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          loadNotifications(true);
        }}
        title="Detalhes da Notificação"
        description="Auditoria de envio e entrega por destinatário"
        size="lg"
        bodyClassName="p-6"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDetailModalOpen(false);
                loadNotifications(true);
              }}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              Fechar
            </button>
            {detailData && detailData.stats.failed > 0 && (
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={retrying}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60"
              >
                <RotateCcw
                  className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`}
                />
                <span>
                  {retrying
                    ? "Reprocessando..."
                    : `Reprocessar ${detailData.stats.failed} Falha(s)`}
                </span>
              </button>
            )}
          </>
        }
      >
        {loadingDetail ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <p className="text-sm">Carregando auditoria de destinatários...</p>
          </div>
        ) : detailData ? (
          <div className="space-y-6">
            {/* Informações da Notificação */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-gray-900 text-base">
                  {detailData.notification.titulo}
                </h3>
                <StatusBadge
                  label={
                    STATUS_CONFIG[detailData.notification.status]?.label ||
                    detailData.notification.status
                  }
                  className={
                    STATUS_CONFIG[detailData.notification.status]?.className
                  }
                />
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {detailData.notification.mensagem}
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>
                  <strong>Público:</strong>{" "}
                  {AUDIENCE_LABELS[detailData.notification.tipoPublico]}
                </span>
                {detailData.notification.ministerio && (
                  <span>
                    <strong>Ministério:</strong>{" "}
                    {detailData.notification.ministerio.nome}
                  </span>
                )}
                <span>
                  <strong>Agendado para:</strong>{" "}
                  {formatDateTime(
                    new Date(detailData.notification.scheduledAt),
                  )}
                </span>
                {detailData.notification.criadoPor && (
                  <span>
                    <strong>Criado por:</strong>{" "}
                    {detailData.notification.criadoPor.nome}
                  </span>
                )}
              </div>
            </div>

            {/* Cards de Entrega */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <p className="text-xs text-emerald-600 font-medium">Entregues</p>
                <p className="text-lg font-bold text-emerald-700">
                  {detailData.stats.sent}
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 font-medium">Na Fila</p>
                <p className="text-lg font-bold text-amber-700">
                  {detailData.stats.pending}
                </p>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
                <p className="text-xs text-rose-600 font-medium">Falhas</p>
                <p className="text-lg font-bold text-rose-700">
                  {detailData.stats.failed}
                </p>
              </div>
              <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 font-medium">Sem Inscrição</p>
                <p className="text-lg font-bold text-gray-700">
                  {detailData.stats.noSubscription}
                </p>
              </div>
            </div>

            {/* Tabela de Destinatários */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Destinatários ({detailData.recipients.meta.total})
              </h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Nome / Usuário</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Tentativas</th>
                      <th className="py-2.5 px-3">Enviado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailData.recipients.data.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-6 text-center text-gray-400"
                        >
                          Nenhum destinatário registrado para este envio.
                        </td>
                      </tr>
                    ) : (
                      detailData.recipients.data.map((r) => {
                        const conf = RECIPIENT_STATUS_CONFIG[r.status] || {
                          label: r.status,
                          className: "bg-gray-100 text-gray-600",
                        };
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3">
                              <p className="font-medium text-gray-900">
                                {r.userName}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {r.userEmail}
                              </p>
                              {r.ultimoErro && (
                                <p className="text-[10px] text-rose-500 mt-0.5">
                                  {r.ultimoErro}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge
                                label={conf.label}
                                className={conf.className}
                              />
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              {r.tentativas}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500">
                              {r.enviadoEm
                                ? formatDateTime(new Date(r.enviadoEm))
                                : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação de Destinatários */}
              {detailData.recipients.meta.totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                  <span>
                    Página {detailData.recipients.meta.page} de{" "}
                    {detailData.recipients.meta.totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={recipientPage <= 1}
                      onClick={() =>
                        openDetailModal(
                          selectedNotificationId!,
                          recipientPage - 1,
                        )
                      }
                      className="px-2.5 py-1 rounded border border-gray-200 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      disabled={
                        recipientPage >= detailData.recipients.meta.totalPages
                      }
                      onClick={() =>
                        openDetailModal(
                          selectedNotificationId!,
                          recipientPage + 1,
                        )
                      }
                      className="px-2.5 py-1 rounded border border-gray-200 disabled:opacity-40"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </ModalShell>

      {/* Modal de Criação / Edição de Comunicado */}
      <ModalShell
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? "Editar Comunicado Agendado" : "Novo Comunicado Web Push"}
        description={
          editingId
            ? "Atualize o conteúdo e a data/hora programada deste comunicado"
            : "Envie um comunicado para toda a igreja ou um ministério específico"
        }
        size="md"
        bodyClassName="p-6"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setCreateModalOpen(false);
                setEditingId(null);
              }}
              disabled={creating}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="notificacao-manual-form"
              disabled={creating}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60"
            >
              {creating
                ? "Salvando..."
                : editingId
                  ? "Salvar Alterações"
                  : createForm.isScheduled
                    ? "Agendar Comunicado"
                    : "Disparar Comunicado"}
            </button>
          </>
        }
      >
        <form id="notificacao-manual-form" onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && <ModalError>{createError}</ModalError>}

          <InputField
            id="titulo"
            label="Título"
            required
            maxLength={120}
            placeholder="Ex: Culto Especial de Louvor neste Domingo"
            value={createForm.titulo}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, titulo: e.target.value }))
            }
          />

          <div>
            <TextareaField
              id="mensagem"
              label="Mensagem"
              required
              rows={4}
              maxLength={500}
              placeholder="Digite a mensagem que aparecerá na notificação do celular/desktop dos membros..."
              value={createForm.mensagem}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, mensagem: e.target.value }))
              }
            />
            <p className="text-right text-[10px] text-gray-400 mt-1">
              {createForm.mensagem.length}/500 caracteres
            </p>
          </div>

          <InputField
            id="urlDestino"
            label="URL de Destino ao Clicar"
            optionalLabel="(Opcional)"
            placeholder="/personal-panel ou /agenda"
            value={createForm.urlDestino}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, urlDestino: e.target.value }))
            }
          />

          {!editingId && (
            <>
              <SelectField
                id="tipoPublico"
                label="Público Alvo"
                required
                value={createForm.tipoPublico}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    tipoPublico: e.target.value as NotificationAudienceType,
                  }))
                }
              >
                <option value="ALL_MEMBERS">Toda a Igreja (Todos os Membros)</option>
                <option value="MINISTRY">Membros de um Ministério</option>
              </SelectField>

              {createForm.tipoPublico === "MINISTRY" && (
                <SelectField
                  id="ministerioId"
                  label="Selecione o Ministério"
                  required
                  value={createForm.ministerioId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      ministerioId: e.target.value,
                    }))
                  }
                >
                  <option value="">Selecione um ministério...</option>
                  {ministerios.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </SelectField>
              )}
            </>
          )}

          {/* Agendamento */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            {!editingId && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={createForm.isScheduled}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      isScheduled: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium">Agendar envio para data e hora futura</span>
              </label>
            )}

            {(createForm.isScheduled || editingId) && (
              <InputField
                id="scheduledAt"
                label={editingId ? "Nova Data e Hora do Disparo" : "Data e Hora do Disparo"}
                type="datetime-local"
                required
                value={createForm.scheduledAt}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    scheduledAt: e.target.value,
                  }))
                }
              />
            )}
          </div>
        </form>
      </ModalShell>

      {/* Modal Padrão de Confirmação de Cancelamento */}
      <ConfirmDialog
        isOpen={Boolean(cancelingItem)}
        title="Cancelar Notificação Agendada"
        description={
          cancelingItem
            ? `Tem certeza que deseja cancelar o envio do comunicado "${cancelingItem.titulo}"? O disparo programado será cancelado na fila e não poderá ser desfeito.`
            : ""
        }
        confirmLabel="Sim, Cancelar Envio"
        cancelLabel="Voltar"
        variant="danger"
        loading={cancelingLoading}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelingItem(null)}
      />
    </div>
  );
}
