-- CreateEnum
CREATE TYPE "member_gender" AS ENUM ('MASCULINO', 'FEMININO');

-- CreateEnum
CREATE TYPE "marital_status" AS ENUM ('SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO', 'UNIAO_ESTAVEL');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('CARTEIRINHA_INDIVIDUAL', 'CARTEIRINHAS_LOTE', 'ESCALA_PDF', 'ESCALA_PNG', 'AGENDA_PDF', 'AGENDA_PNG', 'RELATORIO');

-- CreateEnum
CREATE TYPE "document_format" AS ENUM ('PDF', 'PNG');

-- CreateEnum
CREATE TYPE "document_job_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "tb_member" ADD COLUMN "registration_number" TEXT,
ADD COLUMN "ecclesiastical_role" TEXT,
ADD COLUMN "baptism_date" TIMESTAMP(3),
ADD COLUMN "tax_id" TEXT,
ADD COLUMN "national_id" TEXT,
ADD COLUMN "gender" "member_gender",
ADD COLUMN "marital_status" "marital_status";

-- CreateTable
CREATE TABLE "tb_document_job" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT,
    "document_type" "document_type" NOT NULL,
    "document_format" "document_format" NOT NULL,
    "status" "document_job_status" NOT NULL DEFAULT 'PENDING',
    "parameters" JSONB,
    "version_hash" TEXT,
    "storage_key" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tb_document_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tb_document_job_tenant_id_status_idx" ON "tb_document_job"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tb_document_job_tenant_id_document_type_version_hash_idx" ON "tb_document_job"("tenant_id", "document_type", "version_hash");

-- AddForeignKey
ALTER TABLE "tb_document_job" ADD CONSTRAINT "tb_document_job_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_document_job" ADD CONSTRAINT "tb_document_job_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "tb_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
