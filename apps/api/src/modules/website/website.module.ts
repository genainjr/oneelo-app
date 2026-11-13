import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { PublicWebsiteController } from './public-website.controller';
import { VercelDomainsService } from './vercel-domains.service';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';

@Module({
  imports: [StorageModule],
  controllers: [PublicWebsiteController, WebsiteController],
  providers: [WebsiteService, VercelDomainsService],
  exports: [WebsiteService],
})
export class WebsiteModule {}
