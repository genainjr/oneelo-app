import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [AuthModule, PrismaModule, StorageModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
