-- Align member_limit for tenants based on plan limits
UPDATE "tenants" SET "member_limit" = 999999 WHERE "plan" = 'PROFISSIONAL' AND "member_limit" < 999999;
UPDATE "tenants" SET "member_limit" = 200 WHERE "plan" = 'BASICO' AND "member_limit" = 50;
