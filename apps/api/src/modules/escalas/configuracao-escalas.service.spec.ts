import { Test, TestingModule } from '@nestjs/testing';
import { ConfiguracaoEscalasService } from './configuracao-escalas.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RegraCompatibilidade } from '@prisma/client';

describe('ConfiguracaoEscalasService', () => {
  let service: ConfiguracaoEscalasService;
  let prisma: any;

  const tenantId = 'tenant-1';

  beforeEach(async () => {
    prisma = {
      segmentoCulto: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      ministerioFuncao: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ministerioFuncaoSegmento: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      compatibilidadeFuncao: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguracaoEscalasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ConfiguracaoEscalasService>(ConfiguracaoEscalasService);
  });

  describe('Segmentos do Culto', () => {
    it('listSegmentos: retorna lista ordenada por ordem asc', async () => {
      const segmentosMock = [
        { id: 'seg-1', nome: 'Abertura', ordem: 1 },
        { id: 'seg-2', nome: 'Louvor', ordem: 2 },
      ];
      prisma.segmentoCulto.findMany.mockResolvedValue(segmentosMock);

      const result = await service.listSegmentos(tenantId);

      expect(prisma.segmentoCulto.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { ordem: 'asc' },
      });
      expect(result).toEqual(segmentosMock);
    });

    it('createSegmento: cria com ordem sequencial automática quando não informada', async () => {
      prisma.segmentoCulto.findUnique.mockResolvedValue(null);
      prisma.segmentoCulto.findFirst.mockResolvedValue({ ordem: 3 });
      prisma.segmentoCulto.create.mockResolvedValue({
        id: 'seg-4',
        nome: 'Encerramento',
        ordem: 4,
      });

      const result = await service.createSegmento(tenantId, {
        nome: ' Encerramento ',
      });

      expect(prisma.segmentoCulto.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          nome: 'Encerramento',
          ordem: 4,
        },
      });
      expect(result.ordem).toBe(4);
    });

    it('createSegmento: bloqueia duplicidade de nome no tenant', async () => {
      prisma.segmentoCulto.findUnique.mockResolvedValue({ id: 'seg-1' });

      await expect(
        service.createSegmento(tenantId, { nome: 'Louvor' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.segmentoCulto.create).not.toHaveBeenCalled();
    });

    it('createSegmento: bloqueia duplicidade de ordem explícita no tenant', async () => {
      prisma.segmentoCulto.findUnique
        .mockResolvedValueOnce(null) // nome ok
        .mockResolvedValueOnce({ id: 'seg-existente' }); // ordem duplicada

      await expect(
        service.createSegmento(tenantId, { nome: 'Louvor', ordem: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.segmentoCulto.create).not.toHaveBeenCalled();
    });

    it('updateSegmento: atualiza nome e ordem com sucesso', async () => {
      prisma.segmentoCulto.findFirst.mockResolvedValue({
        id: 'seg-1',
        nome: 'Antigo',
        ordem: 1,
      });
      prisma.segmentoCulto.findUnique.mockResolvedValue(null);
      prisma.segmentoCulto.update.mockResolvedValue({
        id: 'seg-1',
        nome: 'Novo',
        ordem: 2,
      });

      const result = await service.updateSegmento(tenantId, 'seg-1', {
        nome: ' Novo ',
        ordem: 2,
      });

      expect(prisma.segmentoCulto.update).toHaveBeenCalledWith({
        where: { id: 'seg-1' },
        data: { nome: 'Novo', ordem: 2 },
      });
      expect(result.nome).toBe('Novo');
    });

    it('updateSegmento: lança NotFoundException quando segmento não existe no tenant', async () => {
      prisma.segmentoCulto.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSegmento(tenantId, 'seg-outro-tenant', { nome: 'Novo' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reorderSegmentos: reordena todos os segmentos do tenant', async () => {
      prisma.segmentoCulto.findMany.mockResolvedValue([
        { id: 'seg-1' },
        { id: 'seg-2' },
      ]);
      prisma.segmentoCulto.update.mockResolvedValue({});

      const result = await service.reorderSegmentos(tenantId, {
        segmentoIds: ['seg-2', 'seg-1'],
      });

      expect(result.message).toContain('reordenados com sucesso');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('reorderSegmentos: rejeita lista parcial de segmentos', async () => {
      prisma.segmentoCulto.findMany.mockResolvedValue([
        { id: 'seg-1' },
        { id: 'seg-2' },
      ]);

      await expect(
        service.reorderSegmentos(tenantId, { segmentoIds: ['seg-1'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deleteSegmento: remove segmento com sucesso', async () => {
      prisma.segmentoCulto.findFirst.mockResolvedValue({ id: 'seg-1' });
      prisma.segmentoCulto.delete.mockResolvedValue({});

      const result = await service.deleteSegmento(tenantId, 'seg-1');

      expect(prisma.segmentoCulto.delete).toHaveBeenCalledWith({
        where: { id: 'seg-1' },
      });
      expect(result.message).toContain('removido com sucesso');
    });

    it('loadTemplatePadrao: cria 4 segmentos padrão quando não há nenhum', async () => {
      prisma.segmentoCulto.count.mockResolvedValue(0);
      prisma.segmentoCulto.findMany.mockResolvedValue([
        { id: 'seg-1', nome: 'Abertura', ordem: 1 },
        { id: 'seg-2', nome: 'Louvor', ordem: 2 },
        { id: 'seg-3', nome: 'Pregação', ordem: 3 },
        { id: 'seg-4', nome: 'Encerramento', ordem: 4 },
      ]);

      const result = await service.loadTemplatePadrao(tenantId);

      expect(prisma.segmentoCulto.create).toHaveBeenCalledTimes(4);
      expect(result.length).toBe(4);
    });

    it('loadTemplatePadrao: bloqueia carregamento quando tenant já possui segmentos', async () => {
      prisma.segmentoCulto.count.mockResolvedValue(2);

      await expect(service.loadTemplatePadrao(tenantId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.segmentoCulto.create).not.toHaveBeenCalled();
    });
  });

  describe('Configuração de Funções (Segmentos e Locais)', () => {
    it('listFuncoes: lista funções incluindo ministério e segmentos ordenados', async () => {
      prisma.ministerioFuncao.findMany.mockResolvedValue([
        {
          id: 'func-1',
          nome: 'Vocal',
          localAtuacao: 'Palco',
          ministerio: { id: 'min-1', nome: 'Louvor' },
          segmentos: [{ segmento: { id: 'seg-2', nome: 'Louvor', ordem: 2 } }],
        },
      ]);

      const result = await service.listFuncoes(tenantId, 'min-1');

      expect(prisma.ministerioFuncao.findMany).toHaveBeenCalledWith({
        where: {
          ministerio: {
            tenantId,
            id: 'min-1',
          },
        },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
      expect(result.length).toBe(1);
    });

    it('updateFuncaoConfiguracao: atualiza local e sincroniza segmentos', async () => {
      prisma.ministerioFuncao.findFirst.mockResolvedValue({ id: 'func-1' });
      prisma.segmentoCulto.count.mockResolvedValue(2);
      prisma.ministerioFuncao.findUnique.mockResolvedValue({
        id: 'func-1',
        nome: 'Vocal',
        localAtuacao: 'Palco',
        segmentos: [
          { segmento: { id: 'seg-1', nome: 'Abertura', ordem: 1 } },
          { segmento: { id: 'seg-2', nome: 'Louvor', ordem: 2 } },
        ],
      });

      const result = await service.updateFuncaoConfiguracao(
        tenantId,
        'func-1',
        {
          localAtuacao: ' Palco ',
          segmentoIds: ['seg-1', 'seg-2'],
        },
      );

      expect(prisma.ministerioFuncao.update).toHaveBeenCalledWith({
        where: { id: 'func-1' },
        data: { localAtuacao: 'Palco' },
      });
      expect(prisma.ministerioFuncaoSegmento.deleteMany).toHaveBeenCalledWith({
        where: { funcaoId: 'func-1' },
      });
      expect(prisma.ministerioFuncaoSegmento.createMany).toHaveBeenCalledWith({
        data: [
          { funcaoId: 'func-1', segmentoId: 'seg-1' },
          { funcaoId: 'func-1', segmentoId: 'seg-2' },
        ],
      });
      expect(result?.localAtuacao).toBe('Palco');
    });

    it('updateFuncaoConfiguracao: bloqueia segmento de outro tenant', async () => {
      prisma.ministerioFuncao.findFirst.mockResolvedValue({ id: 'func-1' });
      prisma.segmentoCulto.count.mockResolvedValue(1); // apenas 1 de 2 válidos

      await expect(
        service.updateFuncaoConfiguracao(tenantId, 'func-1', {
          segmentoIds: ['seg-meu', 'seg-outro-tenant'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updateFuncaoConfiguracao: renomeia a função e atualiza local com sucesso', async () => {
      prisma.ministerioFuncao.findFirst
        .mockResolvedValueOnce({ id: 'func-1', ministerioId: 'min-1' }) // busca da função
        .mockResolvedValueOnce(null); // verificação de duplicidade de nome
      prisma.segmentoCulto.count.mockResolvedValue(1);
      prisma.ministerioFuncao.findUnique.mockResolvedValue({
        id: 'func-1',
        nome: 'Ministro Principal',
        localAtuacao: 'Altar',
        segmentos: [],
      });

      const result = await service.updateFuncaoConfiguracao(tenantId, 'func-1', {
        nome: '  Ministro Principal  ',
        localAtuacao: 'Altar',
        segmentoIds: ['seg-1'],
      });

      expect(prisma.ministerioFuncao.update).toHaveBeenCalledWith({
        where: { id: 'func-1' },
        data: {
          nome: 'Ministro Principal',
          localAtuacao: 'Altar',
        },
      });
      expect(result?.nome).toBe('Ministro Principal');
    });

    it('updateFuncaoConfiguracao: rejeita nome duplicado no mesmo ministério', async () => {
      prisma.ministerioFuncao.findFirst
        .mockResolvedValueOnce({ id: 'func-1', ministerioId: 'min-1' }) // busca da função
        .mockResolvedValueOnce({ id: 'func-2', nome: 'Violão' }); // já existe outra com esse nome

      await expect(
        service.updateFuncaoConfiguracao(tenantId, 'func-1', {
          nome: 'Violão',
          segmentoIds: [],
        }),
      ).rejects.toThrow('Já existe uma função com este nome neste ministério.');
    });
  });

  describe('Matriz de Compatibilidade', () => {
    it('listCompatibilidades: retorna lista de regras cadastradas com funções', async () => {
      prisma.compatibilidadeFuncao.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          regra: RegraCompatibilidade.PERMITIR,
          funcaoA: { id: 'func-1', nome: 'Ministro' },
          funcaoB: { id: 'func-2', nome: 'Violão' },
        },
      ]);

      const result = await service.listCompatibilidades(tenantId);

      expect(prisma.compatibilidadeFuncao.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result.length).toBe(1);
    });

    it('upsertCompatibilidade: bloqueia regra de uma função com ela mesma', async () => {
      await expect(
        service.upsertCompatibilidade(tenantId, {
          funcaoAId: 'func-1',
          funcaoBId: 'func-1',
          regra: RegraCompatibilidade.PERMITIR,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.compatibilidadeFuncao.upsert).not.toHaveBeenCalled();
    });

    it('upsertCompatibilidade: normaliza ordem dos IDs e salva regra', async () => {
      prisma.ministerioFuncao.findMany.mockResolvedValue([
        { id: 'func-b' },
        { id: 'func-a' },
      ]);
      prisma.compatibilidadeFuncao.upsert.mockResolvedValue({
        id: 'rule-1',
        funcaoAId: 'func-a',
        funcaoBId: 'func-b',
        regra: RegraCompatibilidade.PERMITIR,
      });

      // Passa em ordem inversa para verificar a normalização
      const result = await service.upsertCompatibilidade(tenantId, {
        funcaoAId: 'func-b',
        funcaoBId: 'func-a',
        regra: RegraCompatibilidade.PERMITIR,
        observacao: ' Observação ',
      });

      expect(prisma.compatibilidadeFuncao.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_funcaoAId_funcaoBId: {
            tenantId,
            funcaoAId: 'func-a',
            funcaoBId: 'func-b',
          },
        },
        create: {
          tenantId,
          funcaoAId: 'func-a',
          funcaoBId: 'func-b',
          regra: RegraCompatibilidade.PERMITIR,
          observacao: 'Observação',
        },
        update: {
          regra: RegraCompatibilidade.PERMITIR,
          observacao: 'Observação',
        },
        include: expect.any(Object),
      });
      expect(result).toBeDefined();
    });

    it('upsertCompatibilidade: remove regra quando regra é null (reverte para bloqueio)', async () => {
      prisma.ministerioFuncao.findMany.mockResolvedValue([
        { id: 'func-a' },
        { id: 'func-b' },
      ]);
      prisma.compatibilidadeFuncao.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.upsertCompatibilidade(tenantId, {
        funcaoAId: 'func-a',
        funcaoBId: 'func-b',
        regra: null,
      });

      expect(prisma.compatibilidadeFuncao.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          funcaoAId: 'func-a',
          funcaoBId: 'func-b',
        },
      });
      expect(result.message).toContain('bloqueio padrão');
    });

    it('deleteCompatibilidade: remove regra por ID', async () => {
      prisma.compatibilidadeFuncao.findFirst.mockResolvedValue({ id: 'rule-1' });
      prisma.compatibilidadeFuncao.delete.mockResolvedValue({});

      const result = await service.deleteCompatibilidade(tenantId, 'rule-1');

      expect(prisma.compatibilidadeFuncao.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
      expect(result.message).toContain('removida com sucesso');
    });

    it('deleteCompatibilidade: lança NotFoundException quando regra não existe', async () => {
      prisma.compatibilidadeFuncao.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteCompatibilidade(tenantId, 'rule-inexistente'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
