BEGIN;

-- Preflight: preserve existing schedule days and stop before creating the
-- constraint if production contains duplicate event links in one schedule.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "tb_schedule_day"
    WHERE "event_id" IS NOT NULL
    GROUP BY "schedule_id", "event_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate schedule/event links found. Audit tb_schedule_day before applying this migration.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "tb_event_ministry"
ADD COLUMN "requires_schedule" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "tb_event_ministry_ministry_id_requires_schedule_idx"
ON "tb_event_ministry"("ministry_id", "requires_schedule");

-- CreateIndex
CREATE UNIQUE INDEX "tb_schedule_day_schedule_id_event_id_key"
ON "tb_schedule_day"("schedule_id", "event_id");

COMMIT;
