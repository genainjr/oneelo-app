import { Test, TestingModule } from '@nestjs/testing';
import { MembrosController } from './membros.controller';
import { MembrosService } from './membros.service';
import { MemberImportService } from './import/member-import.service';
import { BadRequestException } from '@nestjs/common';

describe('MembrosController - Import Endpoints', () => {
  let controller: MembrosController;
  let memberImportService: jest.Mocked<MemberImportService>;
  let membrosService: jest.Mocked<MembrosService>;

  beforeEach(async () => {
    const mockMembrosService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockMemberImportService = {
      generatePreview: jest.fn(),
      confirmImport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembrosController],
      providers: [
        { provide: MembrosService, useValue: mockMembrosService },
        { provide: MemberImportService, useValue: mockMemberImportService },
      ],
    }).compile();

    controller = module.get<MembrosController>(MembrosController);
    memberImportService = module.get(MemberImportService);
    membrosService = module.get(MembrosService);
  });

  describe('GET import/template', () => {
    it('deve enviar buffer com headers apropriados de attachment XLSX', async () => {
      const resMock = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.downloadTemplate(resMock);

      expect(resMock.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(resMock.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="modelo-importacao-membros-oneelo.xlsx"',
      );
      expect(resMock.send).toHaveBeenCalled();
    });
  });

  describe('POST import/preview', () => {
    it('deve rejeitar arquivo ausente', async () => {
      const user = { sub: 'u1', email: 'a@a.com', role: 'ADMIN', tenantId: 't1' };
      await expect(
        controller.previewImport(null as any, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar extensão inválida (ex: .pdf)', async () => {
      const user = { sub: 'u1', email: 'a@a.com', role: 'ADMIN', tenantId: 't1' };
      const file = {
        originalname: 'teste.pdf',
        buffer: Buffer.from('fake'),
      } as any;

      await expect(
        controller.previewImport(file, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve chamar memberImportService.generatePreview para .xlsx válido', async () => {
      const user = { sub: 'u1', email: 'a@a.com', role: 'ADMIN', tenantId: 't1' };
      const file = {
        originalname: 'membros.xlsx',
        buffer: Buffer.from('fake-xlsx'),
      } as any;

      memberImportService.generatePreview.mockResolvedValue({
        totalLinhas: 1,
        validosCount: 1,
        duplicadosCount: 0,
        errosCount: 0,
        limitePlano: { limite: 50, totalAtivos: 10, disponiveis: 40, excedeuLimite: false },
        linhas: [],
      });

      const result = await controller.previewImport(file, user);
      expect(memberImportService.generatePreview).toHaveBeenCalledWith(
        't1',
        file.buffer,
        'membros.xlsx',
      );
      expect(result.validosCount).toBe(1);
    });
  });

  describe('POST import/confirm', () => {
    it('deve chamar memberImportService.confirmImport com tenantId e userId', async () => {
      const user = { sub: 'user-123', email: 'a@a.com', role: 'ADMIN', tenantId: 't1' };
      const dto = {
        estrategiaDuplicados: 'SKIP' as const,
        membros: [{ linha: 2, nome: 'João', statusLinha: 'VALIDO' as const }],
      };

      memberImportService.confirmImport.mockResolvedValue({
        totalProcessados: 1,
        inseridos: 1,
        atualizados: 0,
        pulados: 0,
      });

      const result = await controller.confirmImport(dto, user);
      expect(memberImportService.confirmImport).toHaveBeenCalledWith(
        't1',
        'user-123',
        dto,
      );
      expect(result.inseridos).toBe(1);
    });
  });

  describe('bulkDelete endpoints', () => {
    it('deve chamar membrosService.bulkRemove no POST bulk-delete', async () => {
      const req = { tenantId: 't1', user: { sub: 'u1' } };
      const dto = { ids: ['m1', 'm2'] };
      membrosService.bulkRemove = jest.fn().mockResolvedValue({ count: 2, message: '2 removidos' });

      const res = await controller.bulkDeletePost(dto as any, req as any);
      expect(membrosService.bulkRemove).toHaveBeenCalledWith('t1', ['m1', 'm2'], 'u1');
      expect(res.count).toBe(2);
    });

    it('deve chamar membrosService.bulkRemove no DELETE bulk', async () => {
      const req = { tenantId: 't1', user: { sub: 'u1' } };
      const dto = { ids: ['m1'] };
      membrosService.bulkRemove = jest.fn().mockResolvedValue({ count: 1, message: '1 removido' });

      const res = await controller.bulkDelete(dto as any, req as any);
      expect(membrosService.bulkRemove).toHaveBeenCalledWith('t1', ['m1'], 'u1');
      expect(res.count).toBe(1);
    });
  });

  describe('POST :id/promover', () => {
    it('deve chamar membrosService.promoteVisitante com tenantId, id, dto, userId e ip', async () => {
      const req = { tenantId: 't1', user: { sub: 'admin-1' } };
      const dto = { email: 'novo@igreja.com', criarAcesso: true };
      membrosService.promoteVisitante = jest.fn().mockResolvedValue({
        membro: { id: 'm1', status: 'ATIVO' },
        user: { id: 'u1' },
        activationLink: 'https://app/activate/123',
      });

      const res = await controller.promover('m1', dto as any, req as any, '10.0.0.1');
      expect(membrosService.promoteVisitante).toHaveBeenCalledWith(
        't1',
        'm1',
        dto,
        'admin-1',
        '10.0.0.1',
      );
      expect(res.activationLink).toBe('https://app/activate/123');
    });
  });

});
