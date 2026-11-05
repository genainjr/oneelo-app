import { Module } from '@nestjs/common';
import { EventosService } from './eventos.service';
import { EventosController } from './eventos.controller';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { EventoDocumentRendererService } from './export/evento-document-renderer.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthorizationModule, NotificationsModule],
  controllers: [EventosController],
  providers: [EventosService, EventoDocumentRendererService],
  exports: [EventosService, EventoDocumentRendererService],
})
export class EventosModule {}
