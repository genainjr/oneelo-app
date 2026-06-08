-- AlterEnum: add SUPER_ADMIN value
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable User: drop composite unique, make tenantId nullable, add global unique on email
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_email_key";
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");

-- AlterTable AuditLog: make tenantId nullable (FK stays, only applies when non-null)
ALTER TABLE "AuditLog" ALTER COLUMN "tenantId" DROP NOT NULL;
