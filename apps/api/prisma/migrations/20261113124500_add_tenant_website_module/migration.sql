-- CreateEnum
CREATE TYPE "worship_modality" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "dns_status" AS ENUM ('PENDING', 'ACTIVE', 'ERROR');

-- CreateTable
CREATE TABLE "tb_tenant_website_config" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "hero_title" TEXT,
    "hero_subtitle" TEXT,
    "banner_url" TEXT,
    "banner_key" TEXT,
    "theme_verse" TEXT,
    "theme_verse_reference" TEXT,
    "about_us" TEXT,
    "history" TEXT,
    "vision_values" TEXT,
    "pastors_names" TEXT,
    "pastors_bio" TEXT,
    "pastors_photo_url" TEXT,
    "pastors_photo_key" TEXT,
    "address" TEXT,
    "address_number" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "google_maps_url" TEXT,
    "office_hours" TEXT,
    "instagram_url" TEXT,
    "youtube_url" TEXT,
    "facebook_url" TEXT,
    "spotify_url" TEXT,
    "support_whatsapp" TEXT,
    "custom_domain" TEXT,
    "dns_status" "dns_status" NOT NULL DEFAULT 'PENDING',
    "dns_checked_at" TIMESTAMP(3),
    "custom_domain_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_tenant_website_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_church_schedule" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "modality" "worship_modality" NOT NULL DEFAULT 'IN_PERSON',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_church_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_tenant_news" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "image_url" TEXT,
    "image_key" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_tenant_news_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_tenant_website_config_tenant_id_key" ON "tb_tenant_website_config"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_tenant_website_config_custom_domain_key" ON "tb_tenant_website_config"("custom_domain");

-- CreateIndex
CREATE INDEX "tb_church_schedule_tenant_id_is_active_idx" ON "tb_church_schedule"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "tb_church_schedule_tenant_id_display_order_idx" ON "tb_church_schedule"("tenant_id", "display_order");

-- CreateIndex
CREATE INDEX "tb_tenant_news_tenant_id_is_active_idx" ON "tb_tenant_news"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "tb_tenant_news_tenant_id_is_active_published_at_idx" ON "tb_tenant_news"("tenant_id", "is_active", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "tb_tenant_news_tenant_id_slug_key" ON "tb_tenant_news"("tenant_id", "slug");

-- AddForeignKey
ALTER TABLE "tb_tenant_website_config" ADD CONSTRAINT "tb_tenant_website_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_church_schedule" ADD CONSTRAINT "tb_church_schedule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_tenant_news" ADD CONSTRAINT "tb_tenant_news_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
