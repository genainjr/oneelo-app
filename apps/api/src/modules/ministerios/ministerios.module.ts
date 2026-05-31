import { Module } from '@nestjs/common';
import { MinisteriosService } from './ministerios.service';
import { MinisteriosController } from './ministerios.controller';

@Module({
  controllers: [MinisteriosController],
  providers: [MinisteriosService],
  exports: [MinisteriosService],
})
export class MinisteriosModule {}
