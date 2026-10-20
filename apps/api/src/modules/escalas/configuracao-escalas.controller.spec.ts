import { Test, TestingModule } from '@nestjs/testing';
import { ConfiguracaoEscalasController } from './configuracao-escalas.controller';
import { ConfiguracaoEscalasService } from './configuracao-escalas.service';
import { RegraCompatibilidade } from '@prisma/client';

describe('ConfiguracaoEscalasController', () => {
  let controller: ConfiguracaoEscalasController;
  let service: any;

  const mockReq = { tenantId: 'tenant-123' } as any;

  beforeEach(async () => {
    service = {
      listSegmentos: jest.fn().mockResolvedValue([]),
      createSegmento: jest.fn().mockResolvedValue({ id: 'seg-1' }),
      loadTemplatePadrao: jest.fn().mockResolvedValue([]),
      reorderSegmentos: jest.fn().mockResolvedValue({ message: 'ok' }),
      updateSegmento: jest.fn().mockResolvedValue({ id: 'seg-1' }),
      deleteSegmento: jest.fn().mockResolvedValue({ message: 'ok' }),
      listFuncoes: jest.fn().mockResolvedValue([]),
      updateFuncaoConfiguracao: jest.fn().mockResolvedValue({ id: 'func-1' }),
      listCompatibilidades: jest.fn().mockResolvedValue([]),
      upsertCompatibilidade: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      deleteCompatibilidade: jest.fn().mockResolvedValue({ message: 'ok' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfiguracaoEscalasController],
      providers: [
        { provide: ConfiguracaoEscalasService, useValue: service },
      ],
    }).compile();

    controller = module.get<ConfiguracaoEscalasController>(
      ConfiguracaoEscalasController,
    );
  });

  it('deve delegar listSegmentos com tenantId', async () => {
    await controller.listSegmentos(mockReq);
    expect(service.listSegmentos).toHaveBeenCalledWith('tenant-123');
  });

  it('deve delegar createSegmento com tenantId e dto', async () => {
    const dto = { nome: 'Louvor', ordem: 2 };
    await controller.createSegmento(dto, mockReq);
    expect(service.createSegmento).toHaveBeenCalledWith('tenant-123', dto);
  });

  it('deve delegar loadTemplatePadrao com tenantId', async () => {
    await controller.loadTemplatePadrao(mockReq);
    expect(service.loadTemplatePadrao).toHaveBeenCalledWith('tenant-123');
  });

  it('deve delegar reorderSegmentos com tenantId e dto', async () => {
    const dto = { segmentoIds: ['seg-1', 'seg-2'] };
    await controller.reorderSegmentos(dto, mockReq);
    expect(service.reorderSegmentos).toHaveBeenCalledWith('tenant-123', dto);
  });

  it('deve delegar updateSegmento com tenantId, id e dto', async () => {
    const dto = { nome: 'Louvor Atualizado' };
    await controller.updateSegmento('seg-1', dto, mockReq);
    expect(service.updateSegmento).toHaveBeenCalledWith('tenant-123', 'seg-1', dto);
  });

  it('deve delegar deleteSegmento com tenantId e id', async () => {
    await controller.deleteSegmento('seg-1', mockReq);
    expect(service.deleteSegmento).toHaveBeenCalledWith('tenant-123', 'seg-1');
  });

  it('deve delegar listFuncoes com tenantId e ministerioId', async () => {
    await controller.listFuncoes('min-1', mockReq);
    expect(service.listFuncoes).toHaveBeenCalledWith('tenant-123', 'min-1');
  });

  it('deve delegar updateFuncaoConfiguracao com tenantId, id e dto', async () => {
    const dto = { segmentoIds: ['seg-1'], localAtuacao: 'Palco' };
    await controller.updateFuncaoConfiguracao('func-1', dto, mockReq);
    expect(service.updateFuncaoConfiguracao).toHaveBeenCalledWith(
      'tenant-123',
      'func-1',
      dto,
    );
  });

  it('deve delegar listCompatibilidades com tenantId', async () => {
    await controller.listCompatibilidades(mockReq);
    expect(service.listCompatibilidades).toHaveBeenCalledWith('tenant-123');
  });

  it('deve delegar upsertCompatibilidade com tenantId e dto', async () => {
    const dto = {
      funcaoAId: 'func-1',
      funcaoBId: 'func-2',
      regra: RegraCompatibilidade.PERMITIR,
    };
    await controller.upsertCompatibilidade(dto, mockReq);
    expect(service.upsertCompatibilidade).toHaveBeenCalledWith(
      'tenant-123',
      dto,
    );
  });

  it('deve delegar deleteCompatibilidade com tenantId e id', async () => {
    await controller.deleteCompatibilidade('rule-1', mockReq);
    expect(service.deleteCompatibilidade).toHaveBeenCalledWith(
      'tenant-123',
      'rule-1',
    );
  });
});
