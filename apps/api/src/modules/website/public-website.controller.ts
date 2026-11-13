import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { WebsiteService } from './website.service';

@ApiTags('Site Institucional Público')
@Controller('public/site')
@Public()
@UseGuards(ThrottlerGuard)
export class PublicWebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get('resolve')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiQuery({
    name: 'domain',
    required: true,
    description: 'Hostname do domínio customizado a resolver',
  })
  @ApiOperation({
    summary: 'Resolve o slug da igreja a partir de um domínio próprio ativo',
  })
  async resolveCustomDomain(@Query('domain') domain: string) {
    return this.websiteService.resolvePublicDomain(domain);
  }

  @Get(':slug')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary: 'Retorna os dados públicos consolidados do site da igreja',
  })
  async getPublicSite(@Param('slug') slug: string) {
    return this.websiteService.getPublicSiteData(slug);
  }

  @Get(':slug/noticias/:noticiaSlug')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary: 'Retorna um informativo público específico da igreja',
  })
  async getPublicNewsItem(
    @Param('slug') slug: string,
    @Param('noticiaSlug') noticiaSlug: string,
  ) {
    return this.websiteService.getPublicNewsBySlug(slug, noticiaSlug);
  }
}
