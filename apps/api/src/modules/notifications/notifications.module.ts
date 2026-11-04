import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './services/notification-dispatch.service';
import { NotificationQueueProcessorService } from './services/notification-queue-processor.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatchService,
    NotificationQueueProcessorService,
  ],
  exports: [
    NotificationsService,
    NotificationDispatchService,
    NotificationQueueProcessorService,
  ],
})
export class NotificationsModule {}
