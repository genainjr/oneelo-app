import { Module } from '@nestjs/common';
import { MinisteriosService } from './ministerios.service';
import { MinisteriosController } from './ministerios.controller';
import { AuthorizationModule } from '../../common/authorization/authorization.module';

@Module({
  imports: [AuthorizationModule],
  controllers: [MinisteriosController],
  providers: [MinisteriosService],
  exports: [MinisteriosService],
})
export class MinisteriosModule {}
