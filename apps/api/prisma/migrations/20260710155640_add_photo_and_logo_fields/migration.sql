ALTER TABLE "tb_tenant"
ADD COLUMN "logo_url" TEXT,
ADD COLUMN "logo_key" TEXT;

ALTER TABLE "tb_member"
ADD COLUMN "photo_url" TEXT,
ADD COLUMN "photo_key" TEXT;
