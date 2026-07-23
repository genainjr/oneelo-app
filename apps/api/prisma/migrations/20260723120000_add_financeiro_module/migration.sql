-- CreateEnum
CREATE TYPE "finance_role" AS ENUM ('FINANCE_VIEWER', 'FINANCE_OPERATOR', 'FINANCE_APPROVER', 'FINANCE_MANAGER');

-- CreateEnum
CREATE TYPE "financial_account_type" AS ENUM ('CASH', 'BANK', 'PIX', 'OTHER');

-- CreateEnum
CREATE TYPE "financial_category_type" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "financial_transaction_type" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "financial_transaction_status" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tb_finance_permission" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "finance_role" NOT NULL,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_finance_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_financial_account" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "financial_account_type" NOT NULL,
    "initial_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_financial_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_financial_category" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "financial_category_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_financial_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_financial_transaction" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "member_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "cancelled_by_user_id" TEXT,
    "type" "financial_transaction_type" NOT NULL,
    "status" "financial_transaction_status" NOT NULL DEFAULT 'CONFIRMED',
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "payment_method" TEXT,
    "counterparty_name" TEXT,
    "receipt_url" TEXT,
    "receipt_key" TEXT,
    "receipt_file_name" TEXT,
    "receipt_mime_type" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_financial_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_finance_permission_tenant_id_user_id_key" ON "tb_finance_permission"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "tb_finance_permission_tenant_id_idx" ON "tb_finance_permission"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_finance_permission_tenant_id_role_idx" ON "tb_finance_permission"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "tb_finance_permission_tenant_id_revoked_at_idx" ON "tb_finance_permission"("tenant_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "tb_financial_account_tenant_id_name_key" ON "tb_financial_account"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "tb_financial_account_tenant_id_idx" ON "tb_financial_account"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_financial_account_tenant_id_is_active_idx" ON "tb_financial_account"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "tb_financial_account_tenant_id_type_idx" ON "tb_financial_account"("tenant_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tb_financial_category_tenant_id_type_name_key" ON "tb_financial_category"("tenant_id", "type", "name");

-- CreateIndex
CREATE INDEX "tb_financial_category_tenant_id_idx" ON "tb_financial_category"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_financial_category_tenant_id_is_active_idx" ON "tb_financial_category"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "tb_financial_category_tenant_id_type_idx" ON "tb_financial_category"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_idx" ON "tb_financial_transaction"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_date_idx" ON "tb_financial_transaction"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_type_idx" ON "tb_financial_transaction"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_status_idx" ON "tb_financial_transaction"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_account_id_idx" ON "tb_financial_transaction"("tenant_id", "account_id");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_category_id_idx" ON "tb_financial_transaction"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_member_id_idx" ON "tb_financial_transaction"("tenant_id", "member_id");

-- AddForeignKey
ALTER TABLE "tb_finance_permission" ADD CONSTRAINT "tb_finance_permission_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_finance_permission" ADD CONSTRAINT "tb_finance_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_finance_permission" ADD CONSTRAINT "tb_finance_permission_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tb_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_finance_permission" ADD CONSTRAINT "tb_finance_permission_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "tb_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_financial_account" ADD CONSTRAINT "tb_financial_account_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_financial_category" ADD CONSTRAINT "tb_financial_category_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_financial_transaction" ADD CONSTRAINT "tb_financial_transaction_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_financial_transaction" ADD CONSTRAINT "tb_financial_transaction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "tb_financial_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_financial_transaction" ADD CONSTRAINT "tb_financial_transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tb_financial_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_financial_transaction" ADD CONSTRAINT "tb_financial_transaction_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tb_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_financial_transaction" ADD CONSTRAINT "tb_financial_transaction_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tb_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_financial_transaction" ADD CONSTRAINT "tb_financial_transaction_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "tb_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
