-- Add tenant theme customization columns
ALTER TABLE "tb_tenant"
ADD COLUMN IF NOT EXISTS "theme_palette" TEXT,
ADD COLUMN IF NOT EXISTS "primary_color" TEXT;
