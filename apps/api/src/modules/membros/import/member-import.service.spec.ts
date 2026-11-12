import ExcelJS from 'exceljs';
import { MemberImportService } from './member-import.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EstadoCivil, Plano, SexoMembro } from '@prisma/client';

describe('MemberImportService', () => {
  let service: MemberImportService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      tenant: {
        findUnique: jest.fn(),
      },
      client: {
        membro: {
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn(async (cb) => {
          const tx = {
            membro: {
              create: jest.fn().mockResolvedValue({ id: 'new-id' }),
              update: jest.fn().mockResolvedValue({ id: 'updated-id' }),
            },
            auditLog: {
              create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
            },
          };
          return cb(tx);
        }),
      },
    };

    service = new MemberImportService(prismaMock as PrismaService);
  });

  describe('Normalizações Unitárias', () => {
    it('deve normalizar telefones para E.164 brasileiro', () => {
      expect(service.normalizePhone('(11) 98765-4321').phone).toBe('+5511987654321');
      expect(service.normalizePhone('11987654321').phone).toBe('+5511987654321');
      expect(service.normalizePhone(null).phone).toBeUndefined();
    });

    it('deve sanitizar e validar CPF', () => {
      expect(service.normalizeCpf('123.456.789-00').cpf).toBe('12345678900');
      expect(service.normalizeCpf('123').erro).toBeDefined();
    });

    it('deve normalizar datas em vários formatos', () => {
      expect(service.normalizeDate('15/08/1988').dateIso).toBe('1988-08-15');
      expect(service.normalizeDate('1988-08-15').dateIso).toBe('1988-08-15');
      expect(service.normalizeDate(new Date('1990-05-20T00:00:00Z')).dateIso).toBe('1990-05-20');
      expect(service.normalizeDate('32/01/2020').erro).toBeDefined();
    });

    it('deve normalizar Sexo e Estado Civil', () => {
      expect(service.normalizeSexo('Masculino')).toBe(SexoMembro.MASCULINO);
      expect(service.normalizeSexo('F')).toBe(SexoMembro.FEMININO);
      expect(service.normalizeEstadoCivil('Casado(a)')).toBe(EstadoCivil.CASADO);
      expect(service.normalizeEstadoCivil('Solteira')).toBe(EstadoCivil.SOLTEIRO);
    });
  });

  describe('generatePreview (Dry-run)', () => {
    it('deve ler planilha, validar registros e diagnosticar duplicidades e erros', async () => {
      // Monta workbook de teste em memória
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Membros');
      ws.addRow(['Nome Completo*', 'WhatsApp', 'E-mail', 'Data de Nascimento', 'CPF']);
      ws.addRow(['João da Silva', '(11) 98765-4321', 'joao@email.com', '15/05/1990', '123.456.789-01']);
      ws.addRow(['Maria da Silva', '(11) 98765-4321', 'maria@email.com', '20/10/1992', '987.654.321-02']); // Mesmo fone, nome diferente -> compartilhamento legítimo
      ws.addRow(['', '11999998888', 'invalido', '99/99/9999', '123']); // Linha com erros
      ws.addRow(['Carlos Duplicado', '11911112222', 'carlos@email.com', '01/01/1985', '111.222.333-44']); // Duplicado no banco

      const buffer = await workbook.xlsx.writeBuffer();

      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.BASICO,
        limiteMembros: 200,
      });

      prismaMock.client.membro.findMany.mockResolvedValue([
        {
          id: 'existing-carlos',
          nome: 'Carlos Duplicado',
          email: 'carlos@email.com',
          whatsapp: '+5511911112222',
          cpf: '11122233344',
        },
      ]);

      const preview = await service.generatePreview(
        'tenant-1',
        Buffer.from(buffer),
        'teste.xlsx',
      );

      expect(preview.totalLinhas).toBe(4);
      expect(preview.validosCount).toBe(2); // João e Maria
      expect(preview.duplicadosCount).toBe(1); // Carlos
      expect(preview.errosCount).toBe(1); // Linha sem nome

      // Verifica aviso de telefone compartilhado para Maria
      const mariaRow = preview.linhas.find((l) => l.nome === 'Maria da Silva');
      expect(mariaRow?.statusLinha).toBe('VALIDO');

      // Carlos deve ser diagnosticado como DUPLICADO
      const carlosRow = preview.linhas.find((l) => l.nome === 'Carlos Duplicado');
      expect(carlosRow?.statusLinha).toBe('DUPLICADO');
      expect(carlosRow?.membroExistenteId).toBe('existing-carlos');
    });

    it('deve mapear cabeçalhos com barras e detectar alterações em membros duplicados', async () => {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Membros');
      ws.addRow([
        'Nome Completo*',
        'WhatsApp / Celular',
        'Cargo / Função',
        'Matrícula / Rol',
      ]);
      ws.addRow([
        'Carlos da Silva',
        '(11) 91111-2222',
        'Pastor',
        'ROL-999',
      ]);

      const buffer = await workbook.xlsx.writeBuffer();

      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.PROFISSIONAL,
        limiteMembros: null,
      });

      prismaMock.client.membro.findMany.mockResolvedValue([
        {
          id: 'carlos-id',
          nome: 'Carlos da Silva',
          whatsapp: '+5511911112222',
          cargo: 'Membro',
          matricula: null,
        },
      ]);

      const preview = await service.generatePreview(
        'tenant-1',
        Buffer.from(buffer),
        'teste_diff.xlsx',
      );

      expect(preview.duplicadosCount).toBe(1);
      const row = preview.linhas[0];
      expect(row.statusLinha).toBe('DUPLICADO');
      expect(row.cargo).toBe('Pastor');
      expect(row.matricula).toBe('ROL-999');
      expect(row.camposAlterados).toBeDefined();
      expect(row.camposAlterados?.length).toBe(2);
      expect(row.camposAlterados?.map((c) => c.campo)).toEqual(
        expect.arrayContaining(['cargo', 'matricula']),
      );
    });

    it('deve comparar campos e detectar alterações via detectFieldChanges', () => {
      const existing = {
        nome: 'João Silva',
        nomeExibicao: 'João',
        whatsapp: '+5511988887777',
        email: 'joao@old.com',
        cargo: 'Membro',
        dataNascimento: new Date('1990-05-15T00:00:00.000Z'),
      };

      const incoming = {
        nome: 'João Silva',
        nomeExibicao: 'João',
        whatsapp: '+5511988887777',
        email: 'joao@new.com',
        cargo: 'Diácono',
        dataNascimento: '1990-05-15',
      };

      const changes = service.detectFieldChanges(existing, incoming);
      expect(changes.length).toBe(2);
      expect(changes.map((c) => c.campo)).toEqual(['email', 'cargo']);
      expect(changes.find((c) => c.campo === 'cargo')?.anterior).toBe('Membro');
      expect(changes.find((c) => c.campo === 'cargo')?.novo).toBe('Diácono');
    });

    it('deve alertar se a quantidade de novos membros exceder o limite do plano do tenant', async () => {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Membros');
      ws.addRow(['Nome Completo*']);
      ws.addRow(['Novo Membro 1']);
      ws.addRow(['Novo Membro 2']);

      const buffer = await workbook.xlsx.writeBuffer();

      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.GRATUITO,
        limiteMembros: 50,
      });

      // Tenant já tem 49 membros
      const fakeMembers = Array(49).fill({ id: 'm', nome: 'Membro' });
      prismaMock.client.membro.findMany.mockResolvedValue(fakeMembers);

      const preview = await service.generatePreview(
        'tenant-1',
        Buffer.from(buffer),
        'teste.xlsx',
      );

      expect(preview.limitePlano.totalAtivos).toBe(49);
      expect(preview.limitePlano.disponiveis).toBe(1);
      expect(preview.limitePlano.excedeuLimite).toBe(true); // 49 + 2 = 51 > 50
    });
  });

  describe('confirmImport', () => {
    it('deve persistir membros válidos e registrar log de auditoria', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.PROFISSIONAL,
        limiteMembros: null,
      });
      prismaMock.client.membro.count.mockResolvedValue(10);

      const result = await service.confirmImport('tenant-1', 'user-1', {
        estrategiaDuplicados: 'SKIP',
        membros: [
          {
            linha: 2,
            nome: 'João Novo',
            whatsapp: '+5511988887777',
            statusLinha: 'VALIDO',
          },
          {
            linha: 3,
            nome: 'Carlos Existente',
            whatsapp: '+5511911112222',
            statusLinha: 'DUPLICADO',
            membroExistenteId: 'existing-id',
          },
        ],
      });

      expect(result.inseridos).toBe(1);
      expect(result.pulados).toBe(1);
      expect(result.atualizados).toBe(0);
      expect(prismaMock.client.$transaction).toHaveBeenCalled();
    });

    it('deve atualizar membros duplicados quando estratégia for UPDATE', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        plano: Plano.PROFISSIONAL,
        limiteMembros: null,
      });
      prismaMock.client.membro.count.mockResolvedValue(10);

      const result = await service.confirmImport('tenant-1', 'user-1', {
        estrategiaDuplicados: 'UPDATE',
        membros: [
          {
            linha: 2,
            nome: 'Carlos Atualizado',
            cargo: 'Diácono',
            statusLinha: 'DUPLICADO',
            membroExistenteId: 'existing-id',
          },
        ],
      });

      expect(result.inseridos).toBe(0);
      expect(result.atualizados).toBe(1);
      expect(result.pulados).toBe(0);
    });
  });
});
