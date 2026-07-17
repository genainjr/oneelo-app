-- AlterTable
ALTER TABLE "tb_user"
  ADD COLUMN "login_phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tb_user_login_phone_key" ON "tb_user"("login_phone");
