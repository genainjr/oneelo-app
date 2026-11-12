import { Module, forwardRef } from '@nestjs/common';
import { MembrosService } from './membros.service';
import { MembrosController } from './membros.controller';
import { MemberImportService } from './import/member-import.service';
import { SolicitacoesCadastroService } from './solicitacoes-cadastro.service';
import { PublicSolicitacoesController } from './public-solicitacoes.controller';
import { SolicitacoesCadastroController } from './solicitacoes-cadastro.controller';
import { StorageModule } from '../../common/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StorageModule, NotificationsModule, forwardRef(() => AuthModule)],
  controllers: [
    MembrosController,
    PublicSolicitacoesController,
    SolicitacoesCadastroController,
  ],
  providers: [MembrosService, MemberImportService, SolicitacoesCadastroService],
  exports: [MembrosService, MemberImportService, SolicitacoesCadastroService],
})
export class MembrosModule {}
