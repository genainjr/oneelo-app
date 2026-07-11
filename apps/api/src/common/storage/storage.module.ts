import { Module } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';
import { TenantMediaService } from './tenant-media.service';

@Module({
  providers: [SupabaseStorageService, TenantMediaService],
  exports: [SupabaseStorageService, TenantMediaService],
})
export class StorageModule {}
