-- CreateEnum
CREATE TYPE "notification_origin" AS ENUM ('SYSTEM_AUTOMATION', 'COMMUNICATION_GENERAL', 'COMMUNICATION_MINISTRY');

-- CreateEnum
CREATE TYPE "notification_audience_type" AS ENUM ('ALL_MEMBERS', 'MINISTRY', 'SPECIFIC_USERS');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "recipient_delivery_status" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'NO_SUBSCRIPTION');

-- CreateTable
CREATE TABLE "tb_notification" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "target_url" TEXT,
    "origin" "notification_origin" NOT NULL,
    "audience_type" "notification_audience_type" NOT NULL,
    "ministry_id" TEXT,
    "status" "notification_status" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_notification_recipient" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "recipient_delivery_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "locked_until" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_notification_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_notification_idempotency_key_key" ON "tb_notification"("idempotency_key");

-- CreateIndex
CREATE INDEX "tb_notification_tenant_id_status_scheduled_at_idx" ON "tb_notification"("tenant_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "tb_notification_tenant_id_origin_idx" ON "tb_notification"("tenant_id", "origin");

-- CreateIndex
CREATE INDEX "tb_notification_recipient_status_locked_until_idx" ON "tb_notification_recipient"("status", "locked_until");

-- CreateIndex
CREATE INDEX "tb_notification_recipient_notification_id_status_idx" ON "tb_notification_recipient"("notification_id", "status");

-- CreateIndex
CREATE INDEX "tb_notification_recipient_user_id_idx" ON "tb_notification_recipient"("user_id");

-- AddForeignKey
ALTER TABLE "tb_notification" ADD CONSTRAINT "tb_notification_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification" ADD CONSTRAINT "tb_notification_ministry_id_fkey" FOREIGN KEY ("ministry_id") REFERENCES "tb_ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification" ADD CONSTRAINT "tb_notification_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "tb_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification_recipient" ADD CONSTRAINT "tb_notification_recipient_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "tb_notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_notification_recipient" ADD CONSTRAINT "tb_notification_recipient_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
