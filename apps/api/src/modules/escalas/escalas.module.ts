import { Module } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { EscalasController } from './escalas.controller';
import { ConfiguracaoEscalasService } from './configuracao-escalas.service';
import { ConfiguracaoEscalasController } from './configuracao-escalas.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscalaDocumentRendererService } from './export/escala-document-renderer.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ConfiguracaoEscalasController, EscalasController],
  providers: [
    EscalasService,
    ConfiguracaoEscalasService,
    EscalaDocumentRendererService,
  ],
  exports: [EscalasService, ConfiguracaoEscalasService],
})
export class EscalasModule {}
