-- CreateEnum
CREATE TYPE "pix_key_type" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP');

-- CreateEnum
CREATE TYPE "financial_transaction_source" AS ENUM ('TREASURY', 'MEMBER_PORTAL');

-- AlterTable
ALTER TABLE "tb_financial_category"
ADD COLUMN "visible_to_members" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tb_financial_transaction"
ADD COLUMN "payer_name" TEXT,
ADD COLUMN "rejection_reason" TEXT,
ADD COLUMN "source" "financial_transaction_source" NOT NULL DEFAULT 'TREASURY';

-- CreateTable
CREATE TABLE "tb_tenant_pix_config" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "show_on_public_site" BOOLEAN NOT NULL DEFAULT false,
    "pix_key_type" "pix_key_type" NOT NULL,
    "pix_key" TEXT NOT NULL,
    "merchant_name" TEXT NOT NULL,
    "merchant_city" TEXT NOT NULL,
    "txid_prefix" TEXT,
    "default_account_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_tenant_pix_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_tenant_pix_config_tenant_id_key" ON "tb_tenant_pix_config"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_tenant_pix_config_default_account_id_idx" ON "tb_tenant_pix_config"("default_account_id");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_source_status_idx" ON "tb_financial_transaction"("tenant_id", "source", "status");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_member_id_date_idx" ON "tb_financial_transaction"("tenant_id", "member_id", "date");

-- AddForeignKey
ALTER TABLE "tb_tenant_pix_config" ADD CONSTRAINT "tb_tenant_pix_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_tenant_pix_config" ADD CONSTRAINT "tb_tenant_pix_config_default_account_id_fkey" FOREIGN KEY ("default_account_id") REFERENCES "tb_financial_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_tenant_pix_config" ADD CONSTRAINT "tb_tenant_pix_config_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "tb_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
