import { SetMetadata } from '@nestjs/common';
import { MinistryRole } from '@prisma/client';

export const MINISTRY_ROLES_KEY = 'ministryRoles';
export const MinistryRoles = (...roles: MinistryRole[]) =>
  SetMetadata(MINISTRY_ROLES_KEY, roles);
