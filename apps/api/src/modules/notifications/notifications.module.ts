import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './services/notification-dispatch.service';
import { NotificationQueueProcessorService } from './services/notification-queue-processor.service';
import { NotificationAutomationRulesService } from './services/notification-automation-rules.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatchService,
    NotificationQueueProcessorService,
    NotificationAutomationRulesService,
  ],
  exports: [
    NotificationsService,
    NotificationDispatchService,
    NotificationQueueProcessorService,
    NotificationAutomationRulesService,
  ],
})
export class NotificationsModule {}
