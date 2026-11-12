import { Module } from '@nestjs/common';
import { MembrosService } from './membros.service';
import { MembrosController } from './membros.controller';
import { MemberImportService } from './import/member-import.service';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [MembrosController],
  providers: [MembrosService, MemberImportService],
  exports: [MembrosService, MemberImportService],
})
export class MembrosModule {}
