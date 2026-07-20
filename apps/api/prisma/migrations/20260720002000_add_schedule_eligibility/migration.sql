BEGIN;

ALTER TABLE "tb_ministry"
ADD COLUMN "uses_schedules" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "tb_ministry_member"
ADD COLUMN "can_be_scheduled" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "tb_ministry_tenant_id_is_active_uses_schedules_idx"
ON "tb_ministry"("tenant_id", "is_active", "uses_schedules");

CREATE INDEX "tb_ministry_member_ministry_id_can_be_scheduled_idx"
ON "tb_ministry_member"("ministry_id", "can_be_scheduled");

COMMIT;
