"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/app/skeleton";
import { DataTable, Column, SortState } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { UsuarioModal } from "@/components/app/usuario-modal";
import { ImageUploadPanel } from "@/components/app/image-upload-panel";
import { api, buildQuery } from "@/lib/api";
import {
  buildImageFormData,
  IMAGE_UPLOAD_ACCEPT,
  validateImageFile,
} from "@/lib/image-upload";
import { User, AuditLog, AuthUser, PaginatedItemsResponse } from "@/types";
import { useDateFormatter } from "@/hooks/use-date-formatter";

type TenantLogoPayload = NonNullable<AuthUser["tenant"]>;

function formatActivationExpiration(expiresAt?: string | null) {
  if (!expiresAt) return null;

  const expiration = new Date(expiresAt);
  if (Number.isNaN(expiration.getTime())) return null;

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(expiration);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("day")}/${value("month")}/${value("year")} às ${value("hour")}:${value("minute")}`;
}

function buildActivationWelcomeMessage(
  user: User,
  link: string,
  tenantName?: string,
) {
  const churchName = tenantName?.trim() || "nossa igreja";
  const expiration = formatActivationExpiration(user.activationExpiresAt);

  return [
    `Olá, ${user.nome}! Seja muito bem-vindo(a) à ${churchName} no One Elo. \ud83c\udf89`,
    "",
    "Seu acesso foi criado para aproximar você ainda mais da rotina da nossa igreja.",
    "No One Elo, você poderá acompanhar suas escalas, consultar a agenda, manter seu perfil atualizado e receber notificações importantes.",
    "",
    expiration
      ? `Ative sua conta pelo link abaixo. Ele expira em ${expiration} (horário de Brasília):`
      : "Ative sua conta pelo link abaixo (válido por 72 horas):",
    link,
    "",
    "Depois da ativação, confira seus dados em Meu Perfil e habilite as notificações para não perder nenhuma novidade.",
    "",
    "Estamos felizes em ter você com a gente!",
  ].join("\n");
}

export default function ConfiguracoesPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { formatDateTime } = useDateFormatter();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<"usuarios" | "audit">("usuarios");

  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createdActivationLink, setCreatedActivationLink] = useState<
    string | null
  >(null);
  const [createdActivationUser, setCreatedActivationUser] =
    useState<User | null>(null);
  const [activationLinksByUser, setActivationLinksByUser] = useState<
    Record<string, string>
  >({});
  const [activationLinkLoadingId, setActivationLinkLoadingId] = useState<
    string | null
  >(null);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [logoSuccess, setLogoSuccess] = useState("");
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const auditLogsTopRef = useRef<HTMLElement | null>(null);

  const [userPage, setUserPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditResourceFilter, setAuditResourceFilter] = useState("");
  const [auditOperatorFilter, setAuditOperatorFilter] = useState("");
  const [userSort, setUserSort] = useState<SortState>({
    key: "nome",
    direction: "asc",
  });
  const itemsPerPage = 10;

  const sortedUsers = useMemo(() => {
    const arr = [...users];
    arr.sort((a, b) => {
      let cmp = 0;
      if (userSort.key === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = (a.nome || "").localeCompare(b.nome || "", "pt-BR");
      }
      return userSort.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [users, userSort]);

  const pagedUsers = useMemo(
    () =>
      sortedUsers.slice((userPage - 1) * itemsPerPage, userPage * itemsPerPage),
    [sortedUsers, userPage],
  );
  useEffect(() => {
    api
      .get<AuthUser>("/api/auth/me")
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === "ADMIN";
  const logoPreview = currentUser?.tenant?.logoUrl ?? null;
  const auditActionOptions = [
    { value: "", label: t("audit.filters.allOperations") },
    { value: "CRIAR", label: t("audit.actions.CRIAR") },
    { value: "ATUALIZAR", label: t("audit.actions.ATUALIZAR") },
    { value: "DELETAR", label: t("audit.actions.DELETAR") },
    { value: "LOGIN", label: t("audit.actions.LOGIN") },
    { value: "LOGOUT", label: t("audit.actions.LOGOUT") },
  ];
  const auditResourceOptions = [
    { value: "", label: t("audit.filters.allResources") },
    { value: "usuarios", label: t("audit.resources.usuarios") },
    { value: "User", label: t("audit.resources.User") },
    {
      value: "user_auth_provider",
      label: t("audit.resources.user_auth_provider"),
    },
    {
      value: "push_subscription",
      label: t("audit.resources.push_subscription"),
    },
    { value: "membros", label: t("audit.resources.membros") },
    { value: "ministerios", label: t("audit.resources.ministerios") },
    { value: "escalas", label: t("audit.resources.escalas") },
    { value: "Tenant", label: t("audit.resources.Tenant") },
  ];
  const auditOperatorOptions = [
    { value: "", label: t("audit.filters.allOperators") },
    { value: "platform", label: t("audit.platformOperator") },
    ...sortedUsers.map((user) => ({ value: user.id, label: user.nome })),
  ];

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    setError(null);
    try {
      const data = await api.get<User[]>("/api/auth/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || t("errorLoading"));
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin, t]);

  const loadAuditLogs = useCallback(
    async (page: number) => {
      if (!isAdmin) return;
      setAuditLoading(true);
      setError(null);
      try {
        const query = buildQuery({
          page,
          limit: itemsPerPage,
          acao: auditActionFilter || undefined,
          entidade: auditResourceFilter || undefined,
          operador: auditOperatorFilter || undefined,
        });
        const data = await api.get<
          PaginatedItemsResponse<AuditLog> | AuditLog[]
        >(`/api/auth/audit-logs${query}`);

        if (Array.isArray(data)) {
          setAuditLogs(data);
          setAuditTotal(data.length);
        } else {
          setAuditLogs(Array.isArray(data.items) ? data.items : []);
          setAuditTotal(typeof data.total === "number" ? data.total : 0);
        }
      } catch (err: any) {
        setError(err?.message || t("errorLoading"));
      } finally {
        setAuditLoading(false);
      }
    },
    [auditActionFilter, auditOperatorFilter, auditResourceFilter, isAdmin, t],
  );

  const reloadActiveData = useCallback(() => {
    return activeTab === "usuarios" ? loadUsers() : loadAuditLogs(auditPage);
  }, [activeTab, auditPage, loadAuditLogs, loadUsers]);

  useEffect(() => {
    if (currentUser && isAdmin) {
      loadUsers();
    }
  }, [currentUser, isAdmin, loadUsers]);

  useEffect(() => {
    if (currentUser && isAdmin) {
      loadAuditLogs(auditPage);
    }
  }, [currentUser, isAdmin, auditPage, loadAuditLogs]);

  function openCreate() {
    setEditingUser(null);
    setCreatedActivationLink(null);
    setCreatedActivationUser(null);
    setModalOpen(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setCreatedActivationLink(null);
    setCreatedActivationUser(null);
    setModalOpen(true);
  }

  async function handleSave(data: Partial<User> & { senha?: string }) {
    if (editingUser) {
      await api.patch(`/api/auth/users/${editingUser.id}`, data);
    } else {
      const created = await api.post<User>("/api/auth/users", data);
      setCreatedActivationLink(created.activationLink ?? null);
      setCreatedActivationUser(created.activationLink ? created : null);
      if (created.activationLink) {
        setActivationLinksByUser((current) => ({
          ...current,
          [created.id]: created.activationLink!,
        }));
      }
    }
    await loadUsers();
    if (auditPage === 1) {
      await loadAuditLogs(1);
    } else {
      setAuditPage(1);
    }
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/auth/users/${deletingUser.id}`);
      setDeletingUser(null);
      await loadUsers();
      if (auditPage === 1) {
        await loadAuditLogs(1);
      } else {
        setAuditPage(1);
      }
    } catch (err: any) {
      setError(err?.message || t("errorDeactivate"));
      setDeletingUser(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  function openLogoPicker() {
    logoInputRef.current?.click();
  }

  function updateTenantLogoState(tenant: TenantLogoPayload) {
    setCurrentUser((current) =>
      current
        ? {
            ...current,
            tenant: {
              ...current.tenant!,
              ...tenant,
            },
          }
        : current,
    );
  }

  async function handleLogoSelected(file: File | undefined) {
    if (!file) return;

    setLogoError("");
    setLogoSuccess("");

    const validationError = validateImageFile(file);
    if (validationError) {
      setLogoError(validationError);
      return;
    }

    setLogoLoading(true);
    try {
      const updated = await api.post<TenantLogoPayload>(
        "/api/auth/tenant/logo",
        buildImageFormData(file),
      );
      updateTenantLogoState(updated);
      setLogoSuccess("Logo atualizada com sucesso.");
    } catch (err: any) {
      setLogoError(err?.message || "Nao foi possivel atualizar a logo.");
    } finally {
      setLogoLoading(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveLogo() {
    setLogoError("");
    setLogoSuccess("");
    setLogoRemoving(true);
    try {
      const updated = await api.delete<TenantLogoPayload>(
        "/api/auth/tenant/logo",
      );
      updateTenantLogoState(updated);
      setLogoSuccess("Logo removida com sucesso.");
    } catch (err: any) {
      setLogoError(err?.message || "Nao foi possivel remover a logo.");
    } finally {
      setLogoRemoving(false);
    }
  }

  function scrollAuditLogsToTop() {
    if (typeof window === "undefined") return;

    window.setTimeout(() => {
      const target = auditLogsTopRef.current;
      if (!target) return;

      const dashboardScrollContainer = target.closest<HTMLElement>(
        "[data-dashboard-scroll-container]",
      );

      if (dashboardScrollContainer) {
        const containerRect = dashboardScrollContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const top =
          dashboardScrollContainer.scrollTop +
          targetRect.top -
          containerRect.top -
          16;

        dashboardScrollContainer.scrollTo({
          top: Math.max(top, 0),
          behavior: "smooth",
        });
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function handleAuditPageChange(page: number) {
    setAuditPage(page);
    scrollAuditLogsToTop();
  }

  if (!currentUser) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <Skeleton className="h-4 w-3/4 bg-gray-250" />
            <div className="space-y-2">
              <Skeleton className="h-4 bg-gray-250" />
              <Skeleton className="h-4 w-5/6 bg-gray-250" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12 text-center bg-white border border-gray-150 shadow-sm rounded-2xl">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          {t("accessRestricted.title")}
        </h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {t("accessRestricted.description")}
        </p>
        <button
          onClick={() => (window.location.href = "/")}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
        >
          {t("accessRestricted.backToDashboard")}
        </button>
      </div>
    );
  }

  function renderUserRoleBadge(user: User) {
    const badges: Record<string, string> = {
      ADMIN: "bg-red-50 text-red-700 border-red-100",
      STAFF: "bg-indigo-50 text-indigo-700 border-indigo-100",
      BASIC: "bg-gray-50 text-gray-600 border-gray-200",
    };

    return (
      <StatusBadge
        label={tCommon(`roles.${user.role}` as any) || user.role}
        className={`rounded-lg border ${badges[user.role] || "bg-gray-50"}`}
      />
    );
  }

  function renderUserStatusBadge(user: User) {
    if (user.status === "PENDING") {
      return (
        <StatusBadge
          label="Pendente"
          className="border bg-amber-50 text-amber-700 border-amber-100"
        />
      );
    }

    const isActive = user.status ? user.status === "ACTIVE" : user.ativo;

    return (
      <StatusBadge
        label={isActive ? t("users.status.active") : t("users.status.inactive")}
        className={`border ${isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-100 text-gray-500 border-gray-250"}`}
      />
    );
  }

  async function copyActivationInvitation(user: User, link: string) {
    const message = buildActivationWelcomeMessage(
      user,
      link,
      currentUser?.tenant?.nome,
    );

    if (!navigator.clipboard) {
      setError(
        "Nao foi possivel copiar o convite de ativacao neste navegador.",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
    } catch {
      setError("Nao foi possivel copiar o convite de ativacao.");
    }
  }

  async function copyActivationLink(user: User) {
    const link = activationLinksByUser[user.id] || user.activationLink;
    if (!link) return;

    await copyActivationInvitation(user, link);
  }

  async function regenerateActivationLink(user: User) {
    setActivationLinkLoadingId(user.id);
    setError(null);

    try {
      const updated = await api.post<User>(
        `/api/auth/users/${user.id}/activation-link`,
      );
      if (updated.activationLink) {
        setActivationLinksByUser((current) => ({
          ...current,
          [user.id]: updated.activationLink!,
        }));
        setCreatedActivationLink(updated.activationLink);
        setCreatedActivationUser(updated);
      }
      await loadUsers();
      if (auditPage === 1) {
        await loadAuditLogs(1);
      } else {
        setAuditPage(1);
      }
    } catch (err: any) {
      setError(err?.message || "Nao foi possivel gerar novo link de ativacao.");
    } finally {
      setActivationLinkLoadingId(null);
    }
  }

  function getAuditActionLabel(action: string) {
    const labels: Record<string, string> = {
      CRIAR: t("audit.actions.CRIAR"),
      ATUALIZAR: t("audit.actions.ATUALIZAR"),
      DELETAR: t("audit.actions.DELETAR"),
      LOGIN: t("audit.actions.LOGIN"),
      LOGOUT: t("audit.actions.LOGOUT"),
    };

    return labels[action] ?? action;
  }

  function getAuditResourceLabel(resource: string) {
    const labels: Record<string, string> = {
      usuarios: t("audit.resources.usuarios"),
      User: t("audit.resources.User"),
      user_auth_provider: t("audit.resources.user_auth_provider"),
      push_subscription: t("audit.resources.push_subscription"),
      membros: t("audit.resources.membros"),
      ministerios: t("audit.resources.ministerios"),
      escalas: t("audit.resources.escalas"),
      Tenant: t("audit.resources.Tenant"),
    };

    return labels[resource] ?? resource;
  }

  function getAuditOperatorName(log: AuditLog) {
    if (log.user?.role === "SUPER_ADMIN") {
      return t("audit.platformOperator");
    }

    return log.user?.nome || t("audit.system");
  }

  function renderAuditOperationBadge(log: AuditLog) {
    const badges: Record<string, string> = {
      CRIAR: "bg-emerald-50 text-emerald-700 border-emerald-100",
      ATUALIZAR: "bg-blue-50 text-blue-700 border-blue-100",
      DELETAR: "bg-rose-50 text-rose-700 border-rose-100",
      LOGIN: "bg-indigo-50 text-indigo-700 border-indigo-100",
      LOGOUT: "bg-gray-100 text-gray-600 border-gray-200",
    };

    return (
      <StatusBadge
        label={getAuditActionLabel(log.acao)}
        className={`rounded-lg border font-bold ${badges[log.acao] || "bg-gray-50"}`}
      />
    );
  }

  const userColumns: Column<User>[] = [
    {
      key: "nome",
      header: t("users.columns.name"),
      className: "font-semibold text-gray-800",
      sortable: true,
    },
    {
      key: "email",
      header: t("users.columns.email"),
      hideOnMobile: true,
      render: (u) => <span className="text-gray-500">{u.email}</span>,
    },
    {
      key: "role",
      header: t("users.columns.role"),
      render: renderUserRoleBadge,
    },
    {
      key: "membro" as keyof User,
      header: t("users.columns.member"),
      hideOnMobile: true,
      render: (u) =>
        u.membro ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg font-medium">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {u.membro.nome}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: "ativo",
      header: t("users.columns.status"),
      render: renderUserStatusBadge,
    },
    {
      key: "createdAt",
      header: t("users.columns.registeredAt"),
      hideOnMobile: true,
      sortable: true,
      render: (u) => (
        <span className="text-xs text-gray-400">
          {formatDateTime(u.createdAt)}
        </span>
      ),
    },
    {
      key: "id",
      header: t("users.columns.actions"),
      render: (u) => (
        <div className="flex items-center gap-2">
          {u.status === "PENDING" && (
            <button
              onClick={() =>
                activationLinksByUser[u.id]
                  ? copyActivationLink(u)
                  : regenerateActivationLink(u)
              }
              disabled={activationLinkLoadingId === u.id}
              title={
                activationLinksByUser[u.id]
                  ? "Copiar convite de ativacao"
                  : "Gerar link de ativacao"
              }
              className="p-2 border border-amber-100 hover:bg-amber-50 rounded-xl text-amber-600 transition-all flex items-center justify-center disabled:opacity-60"
            >
              {activationLinkLoadingId === u.id ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H15a3 3 0 010 6h-1.5m-3 0H9a3 3 0 010-6h1.5m-3 6h9"
                  />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={() => openEdit(u)}
            title={t("users.editTooltip")}
            className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
          >
            <svg
              className="w-4 h-4 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          {u.id !== currentUser?.id && (
            <button
              onClick={() => setDeletingUser(u)}
              title={t("users.deactivateTooltip")}
              className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  const auditColumns: Column<AuditLog>[] = [
    {
      key: "createdAt",
      header: t("audit.columns.dateTime"),
      render: (log) => (
        <span className="text-xs text-gray-500">
          {formatDateTime(log.createdAt)}
        </span>
      ),
    },
    {
      key: "user",
      header: t("audit.columns.operator"),
      render: (log) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800 text-xs">
            {getAuditOperatorName(log)}
          </span>
          {log.user?.email && (
            <span className="text-[10px] text-gray-400">{log.user.email}</span>
          )}
        </div>
      ),
    },
    {
      key: "acao",
      header: t("audit.columns.operation"),
      render: renderAuditOperationBadge,
    },
    {
      key: "entidade",
      header: t("audit.columns.resource"),
      hideOnMobile: true,
      render: (log) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-700">
            {getAuditResourceLabel(log.entidade)}
          </span>
          {log.entidadeId && (
            <span className="text-[9px] text-gray-400 font-mono">
              ID: {log.entidadeId}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "ipAddress",
      header: t("audit.columns.ipAddress"),
      hideOnMobile: true,
      render: (log) => (
        <span className="text-[11px] text-gray-400 font-mono">
          {log.ipAddress || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 px-4 py-4 sm:space-y-6 sm:p-6">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => reloadActiveData()}
            className="underline font-semibold hover:text-red-800"
          >
            {t("retry")}
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-2xs">
        <input
          ref={logoInputRef}
          type="file"
          accept={IMAGE_UPLOAD_ACCEPT}
          className="hidden"
          onChange={(event) => handleLogoSelected(event.target.files?.[0])}
        />
        <ImageUploadPanel
          title="Logo da igreja"
          description="Imagem usada para identificar o tenant nas telas e impressoes."
          imageUrl={logoPreview}
          fallbackName={currentUser.tenant?.nome || "Igreja"}
          alt={currentUser.tenant?.nome || "Logo da igreja"}
          uploading={logoLoading}
          removing={logoRemoving}
          removeDisabled={!logoPreview}
          onUploadClick={openLogoPicker}
          onRemoveClick={handleRemoveLogo}
          className="border-0 bg-transparent p-0 shadow-none"
        />
        {logoError && (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {logoError}
          </p>
        )}
        {logoSuccess && (
          <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {logoSuccess}
          </p>
        )}
      </section>

      {/* Tabs */}
      <div className="flex flex-col gap-3 border border-gray-100 bg-white rounded-t-2xl px-4 py-3 shadow-2xs sm:flex-row sm:items-center sm:px-5 sm:py-0">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-8">
          <button
            onClick={() => {
              setActiveTab("usuarios");
              setUserPage(1);
            }}
            className={`min-h-11 justify-center rounded-xl px-3 text-sm font-semibold transition-all flex items-center gap-2 sm:min-h-0 sm:rounded-none sm:border-b-2 sm:px-1 sm:py-4 ${activeTab === "usuarios" ? "bg-indigo-50 text-indigo-700 sm:bg-transparent sm:border-indigo-600 sm:text-indigo-600" : "text-gray-500 hover:text-gray-700 sm:border-transparent"}`}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span className="truncate">
              {t("tabs.users")} ({users.length})
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("audit");
              setAuditPage(1);
            }}
            className={`min-h-11 justify-center rounded-xl px-3 text-sm font-semibold transition-all flex items-center gap-2 sm:min-h-0 sm:rounded-none sm:border-b-2 sm:px-1 sm:py-4 ${activeTab === "audit" ? "bg-indigo-50 text-indigo-700 sm:bg-transparent sm:border-indigo-600 sm:text-indigo-600" : "text-gray-500 hover:text-gray-700 sm:border-transparent"}`}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="truncate">
              {t("tabs.audit")} ({auditTotal})
            </span>
          </button>
        </div>

        {activeTab === "usuarios" && (
          <div className="flex items-center sm:ml-auto">
            <button
              onClick={openCreate}
              className="flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all sm:w-auto sm:my-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("users.new")}
            </button>
          </div>
        )}
      </div>

      {activeTab === "usuarios" &&
        createdActivationLink &&
        createdActivationUser && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-2xs">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-amber-900">
                  Usuario criado aguardando ativacao
                </h3>
                <p className="mt-1 text-sm text-amber-800 break-all">
                  {createdActivationLink}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyActivationInvitation(
                    createdActivationUser,
                    createdActivationLink,
                  )
                }
                className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Copiar mensagem de boas-vindas
              </button>
            </div>
          </section>
        )}

      {activeTab === "audit" && (
        <section
          ref={auditLogsTopRef}
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-2xs"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {t("audit.filters.operation")}
              </span>
              <select
                value={auditActionFilter}
                onChange={(event) => {
                  setAuditActionFilter(event.target.value);
                  setAuditPage(1);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              >
                {auditActionOptions.map((option) => (
                  <option
                    key={option.value || "all-actions"}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {t("audit.filters.resource")}
              </span>
              <select
                value={auditResourceFilter}
                onChange={(event) => {
                  setAuditResourceFilter(event.target.value);
                  setAuditPage(1);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              >
                {auditResourceOptions.map((option) => (
                  <option
                    key={option.value || "all-resources"}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {t("audit.filters.operator")}
              </span>
              <select
                value={auditOperatorFilter}
                onChange={(event) => {
                  setAuditOperatorFilter(event.target.value);
                  setAuditPage(1);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              >
                {auditOperatorOptions.map((option) => (
                  <option
                    key={option.value || "all-operators"}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {activeTab === "usuarios" ? (
        <DataTable
          columns={userColumns}
          data={pagedUsers}
          loading={usersLoading}
          sort={userSort}
          onSortChange={(s) => {
            setUserSort(s);
            setUserPage(1);
          }}
          currentPage={userPage}
          totalItems={users.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setUserPage}
          emptyTitle={t("users.noUsers")}
          emptyDescription={t("users.noUsersDesc")}
          renderMobileCard={(user) => (
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-800 truncate">
                    {user.nome}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
                <div className="shrink-0">{renderUserStatusBadge(user)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>{t("users.columns.role")}:</span>
                  {renderUserRoleBadge(user)}
                </div>
                <span>
                  {t("users.columns.registeredAt")}:{" "}
                  {formatDateTime(user.createdAt)}
                </span>
                {user.membro && (
                  <span className="min-w-0 truncate">
                    {t("users.columns.member")}: {user.membro.nome}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                {user.status === "PENDING" && (
                  <button
                    onClick={() =>
                      activationLinksByUser[user.id]
                        ? copyActivationLink(user)
                        : regenerateActivationLink(user)
                    }
                    disabled={activationLinkLoadingId === user.id}
                    title={
                      activationLinksByUser[user.id]
                        ? "Copiar convite de ativacao"
                        : "Gerar link de ativacao"
                    }
                    className="p-2 border border-amber-100 hover:bg-amber-50 rounded-xl text-amber-600 transition-all flex items-center justify-center disabled:opacity-60"
                  >
                    {activationLinkLoadingId === user.id ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 6H15a3 3 0 010 6h-1.5m-3 0H9a3 3 0 010-6h1.5m-3 6h9"
                        />
                      </svg>
                    )}
                  </button>
                )}
                <button
                  onClick={() => openEdit(user)}
                  title={t("users.editTooltip")}
                  className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
                >
                  <svg
                    className="w-4 h-4 text-indigo-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => setDeletingUser(user)}
                    title={t("users.deactivateTooltip")}
                    className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        />
      ) : (
        <DataTable
          columns={auditColumns}
          data={auditLogs}
          loading={auditLoading}
          currentPage={auditPage}
          totalItems={auditTotal}
          itemsPerPage={itemsPerPage}
          onPageChange={handleAuditPageChange}
          emptyTitle={t("audit.noLogs")}
          emptyDescription={t("audit.noLogsDesc")}
          renderMobileCard={(log) => (
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-800 truncate">
                    {getAuditOperatorName(log)}
                  </h3>
                  {log.user?.email && (
                    <p className="text-sm text-gray-500 truncate">
                      {log.user.email}
                    </p>
                  )}
                </div>
                <div className="shrink-0">{renderAuditOperationBadge(log)}</div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                <span>{formatDateTime(log.createdAt)}</span>
                <span>{getAuditResourceLabel(log.entidade)}</span>
                {log.ipAddress && (
                  <span className="font-mono">{log.ipAddress}</span>
                )}
              </div>
            </div>
          )}
        />
      )}

      <UsuarioModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        usuario={editingUser}
        currentUserId={currentUser?.id}
      />

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">
                  {t("deactivate.title")}
                </h3>
                <p className="text-xs text-gray-500">
                  {t("deactivate.subtitle")}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {t("deactivate.message", { name: deletingUser.nome })}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                {t("deactivate.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {deleteLoading && (
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                )}
                {deleteLoading
                  ? t("deactivate.confirming")
                  : t("deactivate.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
