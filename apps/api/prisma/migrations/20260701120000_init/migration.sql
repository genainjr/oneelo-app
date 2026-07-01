-- CreateEnum
CREATE TYPE "plan" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "role" AS ENUM ('ADMIN', 'STAFF', 'BASIC', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ministry_role" AS ENUM ('LEADER', 'ASSISTANT_LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "member_status" AS ENUM ('ACTIVE', 'INACTIVE', 'VISITOR', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "schedule_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "confirmation_status" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT');

-- CreateTable
CREATE TABLE "tb_tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "plan" NOT NULL DEFAULT 'FREE',
    "subscription_status" "subscription_status" NOT NULL DEFAULT 'TRIAL',
    "member_limit" INTEGER NOT NULL DEFAULT 50,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "phone" TEXT,
    "language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_user" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "member_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "role" NOT NULL DEFAULT 'BASIC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_member" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile_phone" TEXT,
    "email" TEXT,
    "birth_date" TIMESTAMP(3),
    "member_status" "member_status" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_label" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL DEFAULT '#6366f1',

    CONSTRAINT "tb_label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_member_label" (
    "member_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    CONSTRAINT "tb_member_label_pkey" PRIMARY KEY ("member_id","label_id")
);

-- CreateTable
CREATE TABLE "tb_ministry" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_ministry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_ministry_position" (
    "id" TEXT NOT NULL,
    "ministry_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color_hex" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tb_ministry_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_ministry_member" (
    "ministry_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role" "ministry_role" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "tb_ministry_member_pkey" PRIMARY KEY ("ministry_id","member_id")
);

-- CreateTable
CREATE TABLE "tb_ministry_member_position" (
    "ministry_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,

    CONSTRAINT "tb_ministry_member_position_pkey" PRIMARY KEY ("ministry_id","member_id","position_id")
);

-- CreateTable
CREATE TABLE "tb_schedule" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ministry_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "schedule_status" "schedule_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_schedule_day" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "event_id" TEXT,
    "notes" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tb_schedule_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_schedule_day_position_hidden" (
    "day_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,

    CONSTRAINT "tb_schedule_day_position_hidden_pkey" PRIMARY KEY ("day_id","position_id")
);

-- CreateTable
CREATE TABLE "tb_schedule_assignment" (
    "id" TEXT NOT NULL,
    "schedule_day_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "user_id" TEXT,
    "ministry_position_id" TEXT NOT NULL,
    "confirmation_status" "confirmation_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,

    CONSTRAINT "tb_schedule_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_event" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "location" TEXT,
    "event_status" "event_status" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_audit_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "audit_action" NOT NULL,
    "payload_before" JSONB,
    "payload_after" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_tenant_slug_key" ON "tb_tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tb_user_member_id_key" ON "tb_user"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_user_email_key" ON "tb_user"("email");

-- CreateIndex
CREATE INDEX "tb_user_tenant_id_idx" ON "tb_user"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_member_tenant_id_idx" ON "tb_member"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_member_tenant_id_deleted_at_idx" ON "tb_member"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "tb_label_tenant_id_idx" ON "tb_label"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_label_tenant_id_name_key" ON "tb_label"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "tb_ministry_tenant_id_idx" ON "tb_ministry"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_ministry_position_ministry_id_name_key" ON "tb_ministry_position"("ministry_id", "name");

-- CreateIndex
CREATE INDEX "tb_schedule_tenant_id_idx" ON "tb_schedule"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_schedule_ministry_id_month_year_key" ON "tb_schedule"("ministry_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "tb_schedule_assignment_schedule_day_id_member_id_key" ON "tb_schedule_assignment"("schedule_day_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_schedule_assignment_schedule_day_id_member_id_ministry_p_key" ON "tb_schedule_assignment"("schedule_day_id", "member_id", "ministry_position_id");

-- CreateIndex
CREATE INDEX "tb_event_tenant_id_idx" ON "tb_event"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_event_tenant_id_start_at_idx" ON "tb_event"("tenant_id", "start_at");

-- CreateIndex
CREATE INDEX "tb_audit_log_tenant_id_idx" ON "tb_audit_log"("tenant_id");

-- CreateIndex
CREATE INDEX "tb_audit_log_tenant_id_entity_entity_id_idx" ON "tb_audit_log"("tenant_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "tb_lead_email_idx" ON "tb_lead"("email");

-- AddForeignKey
ALTER TABLE "tb_user" ADD CONSTRAINT "tb_user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_user" ADD CONSTRAINT "tb_user_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tb_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_member" ADD CONSTRAINT "tb_member_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_label" ADD CONSTRAINT "tb_label_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_member_label" ADD CONSTRAINT "tb_member_label_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tb_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_member_label" ADD CONSTRAINT "tb_member_label_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "tb_label"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_ministry" ADD CONSTRAINT "tb_ministry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_ministry_position" ADD CONSTRAINT "tb_ministry_position_ministry_id_fkey" FOREIGN KEY ("ministry_id") REFERENCES "tb_ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_ministry_member" ADD CONSTRAINT "tb_ministry_member_ministry_id_fkey" FOREIGN KEY ("ministry_id") REFERENCES "tb_ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_ministry_member" ADD CONSTRAINT "tb_ministry_member_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tb_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_ministry_member_position" ADD CONSTRAINT "tb_ministry_member_position_ministry_id_member_id_fkey" FOREIGN KEY ("ministry_id", "member_id") REFERENCES "tb_ministry_member"("ministry_id", "member_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_ministry_member_position" ADD CONSTRAINT "tb_ministry_member_position_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "tb_ministry_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule" ADD CONSTRAINT "tb_schedule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule" ADD CONSTRAINT "tb_schedule_ministry_id_fkey" FOREIGN KEY ("ministry_id") REFERENCES "tb_ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_day" ADD CONSTRAINT "tb_schedule_day_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "tb_schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_day" ADD CONSTRAINT "tb_schedule_day_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "tb_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_day_position_hidden" ADD CONSTRAINT "tb_schedule_day_position_hidden_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "tb_schedule_day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_day_position_hidden" ADD CONSTRAINT "tb_schedule_day_position_hidden_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "tb_ministry_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_assignment" ADD CONSTRAINT "tb_schedule_assignment_schedule_day_id_fkey" FOREIGN KEY ("schedule_day_id") REFERENCES "tb_schedule_day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_assignment" ADD CONSTRAINT "tb_schedule_assignment_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tb_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_assignment" ADD CONSTRAINT "tb_schedule_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tb_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_schedule_assignment" ADD CONSTRAINT "tb_schedule_assignment_ministry_position_id_fkey" FOREIGN KEY ("ministry_position_id") REFERENCES "tb_ministry_position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_event" ADD CONSTRAINT "tb_event_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_audit_log" ADD CONSTRAINT "tb_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_audit_log" ADD CONSTRAINT "tb_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tb_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

