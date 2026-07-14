-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('GOOGLE', 'APPLE');

-- CreateTable
CREATE TABLE "tb_user_auth_provider" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_user_auth_provider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_user_auth_provider_provider_provider_user_id_key" ON "tb_user_auth_provider"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_user_auth_provider_user_id_provider_key" ON "tb_user_auth_provider"("user_id", "provider");

-- CreateIndex
CREATE INDEX "tb_user_auth_provider_user_id_idx" ON "tb_user_auth_provider"("user_id");

-- CreateIndex
CREATE INDEX "tb_user_auth_provider_email_idx" ON "tb_user_auth_provider"("email");

-- AddForeignKey
ALTER TABLE "tb_user_auth_provider" ADD CONSTRAINT "tb_user_auth_provider_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
