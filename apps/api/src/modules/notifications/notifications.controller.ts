import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
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
import {
  ResetAutomationRuleDto,
  UpdateAutomationRulesDto,
} from './dto/automation-rule.dto';
import { UpdateUserNotificationPreferenceDto } from './dto/user-notification-preference.dto';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './services/notification-dispatch.service';
import { NotificationAutomationRulesService } from './services/notification-automation-rules.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationDispatch: NotificationDispatchService,
    private readonly automationRulesService: NotificationAutomationRulesService,
  ) {}

  @Get('public-key')
  getPublicKey() {
    return this.notificationsService.getPublicKey();
  }

  @Public()
  @Post('internal/crons/lembretes')
  @HttpCode(HttpStatus.OK)
  triggerInternalCron(
    @Headers('x-internal-cron-key') apiKey?: string,
    @Query('job') queryJob?: string,
    @Body('job') bodyJob?: string,
  ) {
    const job = queryJob || bodyJob || 'all';
    return this.notificationsService.executeInternalCron(apiKey, job);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findAll(
    @Query() query: FilterNotificationsDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.listNotifications(tenantId, query, user);
  }

  @Get('recipients/available')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  getAvailableRecipients(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.getAvailableRecipients(tenantId);
  }

  @Get('inbox')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  getUserInbox(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const tenantId = (req['tenantId'] as string) || user.tenantId!;
    return this.notificationDispatch.getUserInbox(
      tenantId,
      user.sub,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('inbox/:id/read')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  markNotificationAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = (req['tenantId'] as string) || user.tenantId!;
    return this.notificationDispatch.markNotificationAsRead(
      tenantId,
      user.sub,
      id,
    );
  }

  @Post('inbox/read-all')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  markAllNotificationsAsRead(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = (req['tenantId'] as string) || user.tenantId!;
    return this.notificationDispatch.markAllNotificationsAsRead(
      tenantId,
      user.sub,
    );
  }

  @Get('automation-rules')
  @Roles(Role.ADMIN, Role.STAFF)
  getAutomationRules(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.automationRulesService.getRules(tenantId);
  }

  @Put('automation-rules')
  @Roles(Role.ADMIN, Role.STAFF)
  updateAutomationRules(
    @Body() dto: UpdateAutomationRulesDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.automationRulesService.updateRules(tenantId, dto);
  }

  @Post('automation-rules/reset')
  @Roles(Role.ADMIN, Role.STAFF)
  resetAutomationRule(
    @Body() dto: ResetAutomationRuleDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.automationRulesService.resetRule(tenantId, dto.tipo);
  }

  @Get('preferences')
  getMyPreferences(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = (req['tenantId'] as string) || user.tenantId!;
    return this.automationRulesService.getUserPreferences(user.sub, tenantId);
  }

  @Patch('preferences')
  updateMyPreferences(
    @Body() dto: UpdateUserNotificationPreferenceDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = (req['tenantId'] as string) || user.tenantId!;
    return this.automationRulesService.updateUserPreferences(
      user.sub,
      tenantId,
      dto,
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findOne(
    @Param('id') id: string,
    @Query() query: FilterRecipientsDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.getNotificationById(tenantId, id, query, user);
  }

  @Post(':id/retry')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  retry(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.retryFailedRecipients(tenantId, id, user);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.cancelNotification(id, tenantId, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  updateScheduled(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledNotificationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.notificationDispatch.updateScheduledNotification(tenantId, id, dto, user);
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
