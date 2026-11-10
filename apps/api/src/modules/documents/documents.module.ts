import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';
import { ExportModule } from '../../common/export/export.module';
import { DocumentsController } from './documents.controller';
import { DocumentJobsService } from './document-jobs.service';
import { DocumentWorkerService } from './document-worker.service';
import { CarteirinhaRendererService } from './renderers/carteirinha-renderer.service';

@Module({
  imports: [PrismaModule, StorageModule, ExportModule],
  controllers: [DocumentsController],
  providers: [
    DocumentJobsService,
    DocumentWorkerService,
    CarteirinhaRendererService,
  ],
  exports: [
    DocumentJobsService,
    DocumentWorkerService,
    CarteirinhaRendererService,
  ],
})
export class DocumentsModule {}
