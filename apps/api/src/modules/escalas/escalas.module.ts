import { Module } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { EscalasController } from './escalas.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [EscalasController],
  providers: [EscalasService],
  exports: [EscalasService],
})
export class EscalasModule {}
