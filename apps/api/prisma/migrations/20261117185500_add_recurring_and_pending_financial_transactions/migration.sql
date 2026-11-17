-- AlterEnum
ALTER TYPE "financial_transaction_status" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "tb_financial_transaction" ADD COLUMN     "installment_number" INTEGER,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "recurring_group_id" TEXT,
ADD COLUMN     "total_installments" INTEGER;

-- Backfill effective payment date for already confirmed transactions
UPDATE "tb_financial_transaction"
SET "paid_at" = "date"
WHERE "status" = 'CONFIRMED' AND "paid_at" IS NULL;

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_status_date_idx" ON "tb_financial_transaction"("tenant_id", "status", "date");

-- CreateIndex
CREATE INDEX "tb_financial_transaction_tenant_id_recurring_group_id_idx" ON "tb_financial_transaction"("tenant_id", "recurring_group_id");
