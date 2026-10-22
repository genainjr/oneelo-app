import { Global, Module } from '@nestjs/common';
import { ChromiumRendererService } from './chromium-renderer.service';
import { TenantLogoService } from './tenant-logo.service';
import { DocumentCacheService } from './document-cache.service';

@Global()
@Module({
  providers: [
    ChromiumRendererService,
    TenantLogoService,
    DocumentCacheService,
  ],
  exports: [
    ChromiumRendererService,
    TenantLogoService,
    DocumentCacheService,
  ],
})
export class ExportModule {}
