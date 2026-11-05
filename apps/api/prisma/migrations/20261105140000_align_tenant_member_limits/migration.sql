-- Align member_limit for tenants based on plan limits
UPDATE "tb_tenant" SET "member_limit" = 999999 WHERE "plan" = 'PROFESSIONAL' AND "member_limit" < 999999;
UPDATE "tb_tenant" SET "member_limit" = 200 WHERE "plan" = 'BASIC' AND "member_limit" = 50;
