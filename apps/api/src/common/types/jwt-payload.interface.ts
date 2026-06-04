export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  memberId?: string; // vínculo com Membro (quando existir)
  tenantId: string;
}
