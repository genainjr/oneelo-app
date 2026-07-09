// Tipos e interfaces que espelham as respostas da API

export type Role = 'ADMIN' | 'STAFF' | 'BASIC' | 'SUPER_ADMIN';

export type Plano = 'GRATUITO' | 'BASICO' | 'PROFISSIONAL';

// ─── Tenant (Super Admin) ─────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  nome: string;
  slug: string;
  plano: Plano;
  statusAssinatura: string;
  ativo: boolean;
  email?: string;
  telefone?: string;
  idioma?: string;
  createdAt: string;
  _count?: { users: number };
}

export type MinistryRole = 'LEADER' | 'ASSISTANT_LEADER' | 'MEMBER';

export type StatusMembro = 'ATIVO' | 'INATIVO' | 'VISITANTE' | 'TRANSFERIDO';
export type StatusEscala = 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA';
export type StatusConfirmacao = 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  tenantId: string;
  memberId?: string | null;
  nome: string;
  email: string;
  role: Role;
  createdAt?: string;
  tenant?: {
    nome: string;
    slug: string;
    plano: Plano;
    limiteMembros: number;
  };
  membro?: {
    id: string;
    nome: string;
    email?: string | null;
    whatsapp?: string | null;
    dataNascimento?: string | null;
    status: StatusMembro;
    ministerios?: {
      role: MinistryRole;
      ministerio: { id: string; nome: string };
    }[];
  } | null;
}

export interface LoginDto {
  email: string;
  senha: string;
}

// ─── Tag ──────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  nome: string;
  cor: string;
  _count?: { membros: number };
}

// ─── Membro ───────────────────────────────────────────────────────────────────

export interface Membro {
  id: string;
  tenantId: string;
  nome: string;
  nomeExibicao?: string;
  email?: string;
  whatsapp?: string;
  dataNascimento?: string;
  status: StatusMembro;
  endereco?: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
  ministerios?: (MinisterioMembro & {
    ministerio?: Pick<Ministerio, 'id' | 'nome'>;
  })[];
  tags: { tag: Tag }[];
}

export interface MembroVisualizacao extends Membro {
  ministerios?: (MinisterioMembro & {
    ministerio?: Pick<Ministerio, 'id' | 'nome'>;
  })[];
  _count?: { escalas: number };
}

// ─── Ministério ───────────────────────────────────────────────────────────────

export interface MinisterioFuncao {
  id: string;
  ministerioId: string;
  nome: string;
  descricao?: string;
  corHex?: string;
  ordem: number;
}

export interface MinisterioMembroFuncao {
  funcaoId: string;
  funcao: { id: string; nome: string };
}

export interface MinisterioMembro {
  ministerioId: string;
  membroId: string;
  role: MinistryRole;
  membro?: Pick<Membro, 'id' | 'nome' | 'nomeExibicao' | 'email' | 'whatsapp' | 'status'>;
  funcoesDisponiveis?: MinisterioMembroFuncao[];
}

export interface Ministerio {
  id: string;
  tenantId: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  membros?: MinisterioMembro[];
  funcoes?: MinisterioFuncao[];
  _count?: { membros: number; escalas?: number };
}

// ─── Escala ───────────────────────────────────────────────────────────────────

export interface EscalaItem {
  id: string;
  escalaDiaId: string;
  membroId: string;
  ministerioFuncaoId: string;
  observacoes?: string;
  statusConfirmacao: StatusConfirmacao;
  membro?: Pick<Membro, 'id' | 'nome' | 'nomeExibicao' | 'email' | 'whatsapp'>;
  funcao?: MinisterioFuncao;
}

export interface EscalaDia {
  id: string;
  escalaId: string;
  data: string;
  titulo?: string;
  eventoId?: string;
  observacoes?: string;
  itens?: EscalaItem[];
  funcoesOcultas?: { funcaoId: string }[];
}

export interface Escala {
  id: string;
  tenantId: string;
  ministerioId: string;
  mes: number;
  ano: number;
  observacoes?: string;
  status: StatusEscala;
  createdAt: string;
  updatedAt: string;
  ministerio?: Pick<Ministerio, 'id' | 'nome'> & { funcoes?: MinisterioFuncao[] };
  dias?: EscalaDia[];
  _count?: { dias: number };
}

export interface MinhaEscalaItem extends EscalaItem {
  data: string;
  titulo?: string | null;
  escala: Escala;
  funcao?: MinisterioFuncao;
}

// ─── Evento ───────────────────────────────────────────────────────────────────

export type StatusEvento = 'AGENDADO' | 'REALIZADO' | 'CANCELADO';

export interface Evento {
  id: string;
  tenantId: string;
  titulo: string;
  descricao?: string;
  local?: string;
  dataInicio: string;
  dataFim?: string;
  status: StatusEvento;
  createdAt: string;
  updatedAt: string;
}

// ─── User (Sistema) ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  tenantId: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  memberId?: string | null;
  membro?: { id: string; nome: string } | null;
  createdAt: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  ipAddress?: string;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
  createdAt: string;
  user?: Pick<User, 'id' | 'nome' | 'email'>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalMembrosAtivos: number;
  escalasNaSemana: number;
  aniversariantesDoMes: number;
  ministeriosAtivos: number;
  pendenciasConfirmacao: number;
}

// ─── Paginação ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Erros da API ─────────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
