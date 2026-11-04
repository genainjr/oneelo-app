import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import {
  DeletePushSubscriptionDto,
  SendTestNotificationDto,
  UpsertPushSubscriptionDto,
} from './dto/push-subscription.dto';
import { FilterNotificationsDto } from './dto/filter-notifications.dto';
import { FilterRecipientsDto } from './dto/filter-recipients.dto';
import { CreateManualNotificationDto } from './dto/create-manual-notification.dto';
import { UpdateScheduledNotificationDto } from './dto/update-scheduled-notification.dto';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './services/notification-dispatch.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  @Get('public-key')
  getPublicKey() {
    return this.notificationsService.getPublicKey();
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  findAll(@Query() query: FilterNotificationsDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.listNotifications(tenantId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  findOne(
    @Param('id') id: string,
    @Query() query: FilterRecipientsDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.getNotificationById(tenantId, id, query);
  }

  @Post(':id/retry')
  @Roles(Role.ADMIN, Role.STAFF)
  retry(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.retryFailedRecipients(tenantId, id);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.STAFF)
  cancel(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.cancelNotification(id, tenantId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  updateScheduled(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledNotificationDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.updateScheduledNotification(tenantId, id, dto);
  }

  @Post('manual')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  createManual(
    @Body() dto: CreateManualNotificationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.createManualNotification(
      tenantId,
      user,
      dto,
    );
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
