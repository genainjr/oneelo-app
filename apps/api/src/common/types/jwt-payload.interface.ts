export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  tenantId: string;
}
