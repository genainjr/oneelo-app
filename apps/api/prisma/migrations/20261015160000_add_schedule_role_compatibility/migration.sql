-- CreateEnum
CREATE TYPE "schedule_role_compatibility_rule" AS ENUM ('ALLOW', 'WARN');

-- AlterTable
ALTER TABLE "tb_ministry_position" ADD COLUMN "work_location" TEXT;

-- DropIndex (allows assigning a member to multiple compatible positions on the same schedule day)
DROP INDEX IF EXISTS "tb_schedule_assignment_schedule_day_id_member_id_key";

-- CreateTable
CREATE TABLE "tb_schedule_segment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_schedule_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_ministry_position_segment" (
    "position_id" TEXT NOT NULL,
    "segment_id" TEXT NOT NULL,

    CONSTRAINT "tb_ministry_position_segment_pkey" PRIMARY KEY ("position_id","segment_id")
);

-- CreateTable
CREATE TABLE "tb_schedule_role_compatibility" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "position_a_id" TEXT NOT NULL,
    "position_b_id" TEXT NOT NULL,
    "rule" "schedule_role_compatibility_rule" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_schedule_role_compatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tb_schedule_segment_tenant_id_idx" ON "tb_schedule_segment"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_schedule_segment_tenant_id_name_key" ON "tb_schedule_segment"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tb_schedule_segment_tenant_id_display_order_key" ON "tb_schedule_segment"("tenant_id", "display_order");

-- CreateIndex
CREATE INDEX "tb_schedule_role_compatibility_tenant_id_idx" ON "tb_schedule_role_compatibility"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_schedule_role_compatibility_tenant_id_position_a_id_posi_key" ON "tb_schedule_role_compatibility"("tenant_id", "position_a_id", "position_b_id");

-- AddForeignKey
ALTER TABLE "tb_schedule_segment" ADD CONSTRAINT "tb_schedule_segment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_ministry_position_segment" ADD CONSTRAINT "tb_ministry_position_segment_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "tb_ministry_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_ministry_position_segment" ADD CONSTRAINT "tb_ministry_position_segment_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "tb_schedule_segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_role_compatibility" ADD CONSTRAINT "tb_schedule_role_compatibility_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_role_compatibility" ADD CONSTRAINT "tb_schedule_role_compatibility_position_a_id_fkey" FOREIGN KEY ("position_a_id") REFERENCES "tb_ministry_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_role_compatibility" ADD CONSTRAINT "tb_schedule_role_compatibility_position_b_id_fkey" FOREIGN KEY ("position_b_id") REFERENCES "tb_ministry_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
