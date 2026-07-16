-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "tb_user"
  ADD COLUMN "status" "user_status",
  ADD COLUMN "activation_token_hash" TEXT,
  ADD COLUMN "activation_expires_at" TIMESTAMP(3),
  ADD COLUMN "activation_created_at" TIMESTAMP(3),
  ADD COLUMN "activated_at" TIMESTAMP(3),
  ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Backfill status from the current is_active flag before enforcing NOT NULL.
UPDATE "tb_user"
SET "status" = CASE
  WHEN "is_active" = true THEN 'ACTIVE'::"user_status"
  ELSE 'DISABLED'::"user_status"
END;

ALTER TABLE "tb_user"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "tb_user_status_idx" ON "tb_user"("status");

-- CreateIndex
CREATE INDEX "tb_user_activation_expires_at_idx" ON "tb_user"("activation_expires_at");
