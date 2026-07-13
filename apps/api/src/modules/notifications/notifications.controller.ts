import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import {
  DeletePushSubscriptionDto,
  SendTestNotificationDto,
  UpsertPushSubscriptionDto,
} from './dto/push-subscription.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('public-key')
  getPublicKey() {
    return this.notificationsService.getPublicKey();
  }

  @Post('subscriptions')
  upsertSubscription(
    @Body() dto: UpsertPushSubscriptionDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationsService.upsertSubscription(tenantId, user, dto);
  }

  @Delete('subscriptions')
  deleteSubscription(
    @Body() dto: DeletePushSubscriptionDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationsService.deleteSubscription(tenantId, user, dto);
  }

  @Post('test')
  sendTestNotification(
    @Body() dto: SendTestNotificationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationsService.sendTestNotification(tenantId, user, dto);
  }
}
