import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PwaService } from './pwa.service';

@Controller('pwa')
export class PwaController {
  constructor(private readonly pwaService: PwaService) {}

  @Public()
  @Get(':slug/manifest.webmanifest')
  @Header('Content-Type', 'application/manifest+json')
  async manifest(@Param('slug') slug: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.pwaService.getManifest(slug);
    response.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    response.setHeader('ETag', `"${result.version}"`);
    return result.manifest;
  }
}
