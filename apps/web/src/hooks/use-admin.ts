'use client';

import { api } from '@/lib/api';
import { buildImageFormData } from '@/lib/image-upload';
import { Tenant, Plano, Role } from '@/types';

export interface CreateTenantPayload {
  nome: string;
  slug: string;
  plano?: Plano;
  email?: string;
  telefone?: string;
  idioma?: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
}

export interface UpdateTenantPayload {
  nome?: string;
  plano?: Plano;
  ativo?: boolean;
  email?: string;
  telefone?: string;
  idioma?: string;
}

export interface CreateTenantUserPayload {
  nome: string;
  email: string;
  senha: string;
  role?: Role;
}

export function useAdmin() {
  async function listTenants(): Promise<Tenant[]> {
    return api.get('/api/admin/tenants');
  }

  async function createTenant(data: CreateTenantPayload): Promise<{ tenant: Tenant }> {
    return api.post('/api/admin/tenants', data);
  }

  async function updateTenant(id: string, data: UpdateTenantPayload): Promise<Tenant> {
    return api.patch(`/api/admin/tenants/${id}`, data);
  }

  async function uploadTenantLogo(id: string, file: File): Promise<Tenant> {
    return api.post(`/api/admin/tenants/${id}/logo`, buildImageFormData(file));
  }

  async function removeTenantLogo(id: string): Promise<Tenant> {
    return api.delete(`/api/admin/tenants/${id}/logo`);
  }

  async function createTenantUser(tenantId: string, data: CreateTenantUserPayload) {
    return api.post(`/api/admin/tenants/${tenantId}/usuarios`, data);
  }

  return { listTenants, createTenant, updateTenant, uploadTenantLogo, removeTenantLogo, createTenantUser };
}
