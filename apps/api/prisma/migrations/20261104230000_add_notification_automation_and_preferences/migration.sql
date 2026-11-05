-- CreateEnum
CREATE TYPE "notification_automation_type" AS ENUM ('BIRTHDAY_PERSONAL', 'BIRTHDAY_COMMUNITY', 'SCHEDULE_DAY_REMINDER', 'SCHEDULE_CONFIRMATION_24H', 'EVENT_REMINDER_BEFORE');

-- CreateTable
CREATE TABLE "tb_notification_automation_rule" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "notification_automation_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "schedule_time" TEXT,
    "lead_time_hours" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_notification_automation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_user_notification_preference" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notify_birthdays" BOOLEAN NOT NULL DEFAULT true,
    "notify_events" BOOLEAN NOT NULL DEFAULT true,
    "notify_schedules" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_user_notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tb_notification_automation_rule_tenant_id_idx" ON "tb_notification_automation_rule"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_notification_automation_rule_tenant_id_type_key" ON "tb_notification_automation_rule"("tenant_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tb_user_notification_preference_user_id_key" ON "tb_user_notification_preference"("user_id");

-- CreateIndex
CREATE INDEX "tb_user_notification_preference_tenant_id_idx" ON "tb_user_notification_preference"("tenant_id");

-- AddForeignKey
ALTER TABLE "tb_notification_automation_rule" ADD CONSTRAINT "tb_notification_automation_rule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_user_notification_preference" ADD CONSTRAINT "tb_user_notification_preference_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_user_notification_preference" ADD CONSTRAINT "tb_user_notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
