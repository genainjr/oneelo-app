-- CreateEnum
CREATE TYPE "member_registration_type" AS ENUM ('VISITANTE', 'MEMBRO');

-- CreateEnum
CREATE TYPE "member_registration_status" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateTable
CREATE TABLE "tb_member_registration_request" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "member_registration_type" NOT NULL,
    "status" "member_registration_status" NOT NULL DEFAULT 'PENDENTE',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT,
    "birth_date" TIMESTAMP(3),
    "gender" "member_gender",
    "marital_status" "marital_status",
    "baptized_in_water" BOOLEAN,
    "previous_church" TEXT,
    "invited_by" TEXT,
    "notes" TEXT,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "member_id" TEXT,
    "user_id" TEXT,
    "rejection_reason" TEXT,
    "processed_at" TIMESTAMP(3),
    "processed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_member_registration_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tb_member_registration_request_tenant_id_status_idx" ON "tb_member_registration_request"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tb_member_registration_request_tenant_id_phone_idx" ON "tb_member_registration_request"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "tb_member_registration_request_tenant_id_cpf_idx" ON "tb_member_registration_request"("tenant_id", "cpf");

-- CreateIndex
CREATE INDEX "tb_member_registration_request_tenant_id_email_idx" ON "tb_member_registration_request"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "tb_member_registration_request" ADD CONSTRAINT "tb_member_registration_request_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
