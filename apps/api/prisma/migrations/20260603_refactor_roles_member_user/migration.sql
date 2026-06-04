-- Migration: Refatoração Member × User
-- Separa roles de sistema (ADMIN, STAFF, BASIC) dos roles de ministério (LEADER, ASSISTANT_LEADER, MEMBER)
-- Remove tabela MinisterioLider, unifica em MinisterioMembro com campo role

-- 1. Criar enum MinistryRole
CREATE TYPE "MinistryRole" AS ENUM ('LEADER', 'ASSISTANT_LEADER', 'MEMBER');

-- 2. Adicionar coluna role em MinisterioMembro com default MEMBER
ALTER TABLE "MinisterioMembro" ADD COLUMN "role" "MinistryRole" NOT NULL DEFAULT 'MEMBER';

-- 3. Migrar dados de MinisterioLider → MinisterioMembro com role = LEADER
INSERT INTO "MinisterioMembro" ("ministerioId", "membroId", "role")
SELECT ml."ministerioId", m."id", 'LEADER'::"MinistryRole"
FROM "MinisterioLider" ml
JOIN "User" u ON u."id" = ml."userId"
JOIN "Membro" m ON m."email" = u."email" AND m."tenantId" = u."tenantId"
ON CONFLICT ("ministerioId", "membroId") DO UPDATE SET "role" = 'LEADER';

-- 4. Adicionar coluna memberId em User (nullable, unique)
ALTER TABLE "User" ADD COLUMN "memberId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_key" UNIQUE ("memberId");

-- 5. Vincular User → Membro pelo email (quando existir membro com mesmo email no mesmo tenant)
UPDATE "User" u
SET "memberId" = m."id"
FROM "Membro" m
WHERE m."email" = u."email"
  AND m."tenantId" = u."tenantId"
  AND m."deletedAt" IS NULL;

-- 6. Adicionar FK de User.memberId → Membro.id
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Membro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Migrar enum Role (abordagem: converter dados, recriar tipo limpo)
-- Converter valores antes de recriar o enum
UPDATE "User" SET "role" = 'ADMIN_GERAL' WHERE "role" = 'ADMIN_GERAL';  -- noop, já é
UPDATE "User" SET "role" = 'PASTOR' WHERE "role" = 'SECRETARIO';         -- SECRETARIO → agrupa com PASTOR (ambos viram STAFF)
UPDATE "User" SET "role" = 'MEMBRO' WHERE "role" = 'LIDER_MINISTERIO';   -- LIDER_MINISTERIO → agrupa com MEMBRO (ambos viram BASIC)

-- Recriar enum com novos valores
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'BASIC');

-- Migrar coluna com mapeamento
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role"
  USING CASE
    WHEN "role"::text = 'ADMIN_GERAL' THEN 'ADMIN'::"Role"
    WHEN "role"::text = 'PASTOR' THEN 'STAFF'::"Role"
    WHEN "role"::text = 'MEMBRO' THEN 'BASIC'::"Role"
  END;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'BASIC';

DROP TYPE "Role_old";

-- 8. Dropar tabela MinisterioLider
DROP TABLE "MinisterioLider";
