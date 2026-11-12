import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SolicitacoesCadastroService } from './solicitacoes-cadastro.service';
import { SubmitMemberRegistrationDto } from './dto/submit-member-registration.dto';

@Controller('public/tenants')
@Public()
@UseGuards(ThrottlerGuard)
export class PublicSolicitacoesController {
  constructor(
    private readonly solicitacoesService: SolicitacoesCadastroService,
  ) {}

  @Get(':slug')
  async getTenantInfo(@Param('slug') slug: string) {
    return this.solicitacoesService.getPublicTenantInfo(slug);
  }

  @Post(':slug/members/submit')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async submitMemberRegistration(
    @Param('slug') slug: string,
    @Body() dto: SubmitMemberRegistrationDto,
    @Ip() ip?: string,
  ) {
    return this.solicitacoesService.submitRegistration(slug, dto, ip);
  }
}
