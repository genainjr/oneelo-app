-- CreateTable
CREATE TABLE "tb_push_subscription" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_push_subscription_endpoint_key" ON "tb_push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "tb_push_subscription_tenant_id_idx" ON "tb_push_subscription"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_push_subscription_user_id_idx" ON "tb_push_subscription"("user_id");

-- CreateIndex
CREATE INDEX "tb_push_subscription_tenant_id_user_id_is_active_idx" ON "tb_push_subscription"("tenant_id", "user_id", "is_active");

-- AddForeignKey
ALTER TABLE "tb_push_subscription" ADD CONSTRAINT "tb_push_subscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_push_subscription" ADD CONSTRAINT "tb_push_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
