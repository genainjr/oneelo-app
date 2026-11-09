import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Headers,
  Body,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { NotificationsService } from './notifications.service';

@Controller('internal/crons')
export class InternalCronsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Public()
  @Post('lembretes')
  @HttpCode(HttpStatus.OK)
  async triggerLembretes(
    @Headers('x-internal-cron-key') apiKey?: string,
    @Query('job') queryJob?: string,
    @Body('job') bodyJob?: string,
  ) {
    const job = queryJob || bodyJob || 'all';
    return this.notificationsService.executeInternalCron(apiKey, job);
  }
}
