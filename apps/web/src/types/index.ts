// Tipos e interfaces que espelham as respostas da API

export type Role = 'ADMIN' | 'STAFF' | 'BASIC';

export type MinistryRole = 'LEADER' | 'ASSISTANT_LEADER' | 'MEMBER';

export type StatusMembro = 'ATIVO' | 'INATIVO' | 'VISITANTE' | 'TRANSFERIDO';
export type StatusEscala = 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA';
export type StatusConfirmacao = 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  tenantId: string;
  nome: string;
  email: string;
  role: Role;
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
  email?: string;
  whatsapp?: string;
  dataNascimento?: string;
  status: StatusMembro;
  endereco?: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
  tags: { tag: Tag }[];
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

export interface MinisterioMembro {
  ministerioId: string;
  membroId: string;
  role: MinistryRole;
  membro?: Pick<Membro, 'id' | 'nome' | 'email' | 'whatsapp' | 'status'>;
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
  membro?: Pick<Membro, 'id' | 'nome' | 'email' | 'whatsapp'>;
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

// ─── Evento ───────────────────────────────────────────────────────────────────

export interface Evento {
  id: string;
  tenantId: string;
  titulo: string;
  descricao?: string;
  local?: string;
  inicio: string;
  fim?: string;
  ativo: boolean;
  createdAt: string;
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
