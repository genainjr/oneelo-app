-- AlterTable
ALTER TABLE "tb_notification_recipient" ADD COLUMN "read_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tb_notification_recipient_user_id_read_at_idx" ON "tb_notification_recipient"("user_id", "read_at");
