import { Module } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { EscalasController } from './escalas.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscalaDocumentRendererService } from './export/escala-document-renderer.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EscalasController],
  providers: [EscalasService, EscalaDocumentRendererService],
  exports: [EscalasService],
})
export class EscalasModule {}
