-- AlterTable
ALTER TABLE "tb_schedule_assignment" ADD COLUMN "confirmation_reminder_24h_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tb_schedule_assignment_confirmation_status_confirmation_reminder_24h_sent_at_idx" ON "tb_schedule_assignment"("confirmation_status", "confirmation_reminder_24h_sent_at");
