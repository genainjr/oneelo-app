import { Module } from '@nestjs/common';
import { EventosService } from './eventos.service';
import { EventosController } from './eventos.controller';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { EventoDocumentRendererService } from './export/evento-document-renderer.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [EventosController],
  providers: [EventosService, EventoDocumentRendererService],
  exports: [EventosService, EventoDocumentRendererService],
})
export class EventosModule {}
