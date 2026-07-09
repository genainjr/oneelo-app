-- CreateEnum
CREATE TYPE "event_type" AS ENUM ('GERAL', 'MINISTERIO', 'REUNIAO_INTERNA');

-- AlterTable
ALTER TABLE "tb_event" ADD COLUMN     "type" "event_type" NOT NULL DEFAULT 'GERAL';

-- CreateTable
CREATE TABLE "tb_event_ministry" (
    "event_id" TEXT NOT NULL,
    "ministry_id" TEXT NOT NULL,

    CONSTRAINT "tb_event_ministry_pkey" PRIMARY KEY ("event_id","ministry_id")
);

-- CreateIndex
CREATE INDEX "tb_event_ministry_ministry_id_idx" ON "tb_event_ministry"("ministry_id");

-- CreateIndex
CREATE INDEX "tb_event_tenant_id_type_idx" ON "tb_event"("tenant_id", "type");

-- AddForeignKey
ALTER TABLE "tb_event_ministry" ADD CONSTRAINT "tb_event_ministry_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "tb_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_event_ministry" ADD CONSTRAINT "tb_event_ministry_ministry_id_fkey" FOREIGN KEY ("ministry_id") REFERENCES "tb_ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
