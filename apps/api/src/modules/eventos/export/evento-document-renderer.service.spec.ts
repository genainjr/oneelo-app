import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { chromium } from 'playwright';
import { EventoTipo, StatusEvento } from '@prisma/client';
import { ExportEventoDto } from '../dto/export-evento.dto';
import {
  CHROMIUM_LOW_MEMORY_ARGS,
  EventoDocumentRendererService,
  ExportServiceUnavailableException,
  countPdfPagesFromBuffer,
  formatPeriodSubtitle,
  getEventoPdfFileName,
  listWeeklyEventoPageOptions,
  parseDateFilter,
  renderPdfFooterTemplate,
} from './evento-document-renderer.service';
import type { EventoDocumentInput } from './evento-document.types';

const sampleInput: EventoDocumentInput = {
  organizationName: 'Igreja Batista Central',
  logoUrl: null,
  periodo: {
    dataInicio: '2026-10-01',
    dataFim: '2026-10-31',
  },
  eventos: [
    {
      id: 'evt-1',
      titulo: 'Culto da Família',
      tipo: EventoTipo.GERAL,
      status: StatusEvento.AGENDADO,
      dataInicio: new Date('2026-10-04T22:00:00.000Z'),
      dataFim: new Date('2026-10-05T00:00:00.000Z'),
      local: 'Templo Principal',
      descricao: 'Culto com ceia do Senhor',
      ministerios: [{ id: 'm1', nome: 'Louvor' }],
    },
    {
      id: 'evt-2',
      titulo: 'Ensaio Geral',
      tipo: EventoTipo.MINISTERIO,
      status: StatusEvento.AGENDADO,
      dataInicio: new Date('2026-10-10T18:00:00.000Z'),
      dataFim: new Date('2026-10-10T20:00:00.000Z'),
      local: 'Sala de Música',
      descricao: null,
      ministerios: [{ id: 'm1', nome: 'Louvor' }],
    },
  ],
};

describe('ExportEventoDto', () => {
  it('aceita pagina numerica e pagina="todas"', () => {
    const numericDto = plainToInstance(ExportEventoDto, {
      formato: 'png',
      pagina: '2',
    });
    expect(validateSync(numericDto)).toHaveLength(0);
    expect(numericDto.pagina).toBe(2);

    const batchDto = plainToInstance(ExportEventoDto, {
      formato: 'png',
      pagina: 'todas',
    });
    expect(validateSync(batchDto)).toHaveLength(0);
    expect(batchDto.pagina).toBe('todas');
  });

  it('rejeita pagina invalida', () => {
    const invalidZero = plainToInstance(ExportEventoDto, {
      formato: 'png',
      pagina: '0',
    });
    expect(validateSync(invalidZero).length).toBeGreaterThan(0);

    const invalidText = plainToInstance(ExportEventoDto, {
      formato: 'png',
      pagina: 'invalida',
    });
    expect(validateSync(invalidText).length).toBeGreaterThan(0);
  });
});

describe('EventoDocumentRendererService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lista as semanas disponiveis seguindo a regra de createWeeklyEventoPages', () => {
    const options = listWeeklyEventoPageOptions(sampleInput.eventos);
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      page: 1,
      weekStart: '2026-09-28',
      weekEnd: '2026-10-04',
      eventCount: 1,
    });
    expect(options[1]).toMatchObject({
      page: 2,
      weekStart: '2026-10-05',
      weekEnd: '2026-10-11',
      eventCount: 1,
    });
  });

  it('gera ETag deterministica e responde not-modified sem iniciar o Chromium quando If-None-Match coincide', async () => {
    const launchSpy = jest.spyOn(chromium, 'launch');
    const renderer = new EventoDocumentRendererService();
    const etag = renderer.computeEtag(sampleInput, 'png', 1);

    const result = await renderer.renderExport(sampleInput, 'png', 1, {
      ifNoneMatch: etag,
    });

    expect(result).toEqual({
      kind: 'not-modified',
      etag,
      pageCount: 2,
      notModified: true,
    });
    expect(launchSpy).not.toHaveBeenCalled();

    const changedInput: EventoDocumentInput = {
      ...sampleInput,
      eventos: [
        {
          ...sampleInput.eventos[0],
          titulo: 'Culto Especial de Jovens',
        },
      ],
    };
    expect(renderer.computeEtag(changedInput, 'png', 1)).not.toBe(etag);
  });

  it('passa flags de baixa memoria, bloqueia rede externa, suporta lote PNG em 1 launch e reutiliza cache em memoria', async () => {
    const mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      screenshot: jest
        .fn()
        .mockResolvedValueOnce(Buffer.from('png-week-1'))
        .mockResolvedValueOnce(Buffer.from('png-week-2')),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf-doc')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isConnected: () => true,
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const launchSpy = jest
      .spyOn(chromium, 'launch')
      .mockResolvedValue(mockBrowser as any);

    const renderer = new EventoDocumentRendererService();
    const batchResult = await renderer.renderExport(sampleInput, 'png', 'todas');

    expect(launchSpy).toHaveBeenCalledTimes(1);
    expect(launchSpy).toHaveBeenCalledWith({
      headless: true,
      args: CHROMIUM_LOW_MEMORY_ARGS,
    });
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
    expect(mockPage.setContent).toHaveBeenCalledTimes(2);
    expect(mockPage.setContent.mock.calls[0][0]).toContain('Content-Security-Policy');
    expect(mockPage.setContent.mock.calls[0][0]).toContain('event-card');
    expect(batchResult.kind).toBe('batch');
    if (batchResult.kind === 'batch') {
      expect(batchResult.pageCount).toBe(2);
      expect(batchResult.files).toEqual([
        {
          fileName: 'agenda-semana-2026-10-01.png',
          mimeType: 'image/png',
          base64: Buffer.from('png-week-1').toString('base64'),
        },
        {
          fileName: 'agenda-semana-2026-10-05.png',
          mimeType: 'image/png',
          base64: Buffer.from('png-week-2').toString('base64'),
        },
      ]);
    }

    const cachedBatchResult = await renderer.renderExport(
      sampleInput,
      'png',
      'todas',
    );
    expect(launchSpy).toHaveBeenCalledTimes(1);
    expect(cachedBatchResult).toEqual(batchResult);
  });

  it('renderiza PDF A4 paisagem com agrupamento por dias da semana e tabela com colunas especificadas', async () => {
    const mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isConnected: () => true,
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

    const renderer = new EventoDocumentRendererService();
    const result = await renderer.renderExport(sampleInput, 'pdf', 1);

    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileName).toBe('agenda-eventos-2026-10.pdf');
    }
    const html = mockPage.setContent.mock.calls[0][0] as string;
    expect(html).toContain('weekday-group');
    expect(html).toContain('general-table');
    expect(html).toContain('Culto da Família');
    expect(html).toContain('Ensaio Geral');

    // Colunas Status, Descrição e Ministérios não estão presentes como colunas isoladas
    expect(html).not.toContain('<th>Status</th>');
    expect(html).not.toContain('<th>Descrição</th>');
    expect(html).not.toContain('<th>Ministérios</th>');
    expect(html).toContain('<th>Evento</th>');

    // Destaques e estilização específica de Agenda vertical
    expect(html).toContain('date-time-chip');
    expect(html).toContain('event-title-cell');
    expect(html).toContain('event-title-text');

    // Evento GERAL não deve exibir rótulo de ministério
    expect(html).toContain('<span class="tipo-badge">Geral</span>');

    // Evento MINISTERIO deve exibir o ministério associado entre parênteses
    expect(html).toContain('<span class="tipo-badge ministerio">Ministério</span>');
    expect(html).toContain('<span class="event-ministry-label">(Louvor)</span>');
    expect(html).toContain('Emitido em ');

    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: expect.stringContaining('One Elo'),
        margin: { top: '8mm', right: '8mm', bottom: '12mm', left: '8mm' },
      }),
    );
  });

  describe('Correções de layout e formatação do PDF da Agenda', () => {
    it('formata o subtitulo do periodo de Agosto como "Agosto de 2026" sem deslocamento de timezone', () => {
      const fullMonthInput: EventoDocumentInput = {
        organizationName: 'Igreja Central',
        periodo: {
          dataInicio: '2026-08-01',
          dataFim: '2026-08-31',
        },
        eventos: [],
      };
      expect(formatPeriodSubtitle(fullMonthInput)).toBe('Agosto de 2026');
      expect(parseDateFilter('2026-08-01')).toEqual({ year: 2026, month: 8, day: 1 });
      expect(parseDateFilter('2026-08-31')).toEqual({ year: 2026, month: 8, day: 31 });

      const partialMonthInput: EventoDocumentInput = {
        organizationName: 'Igreja Central',
        periodo: {
          dataInicio: '2026-08-01',
          dataFim: '2026-08-15',
        },
        eventos: [],
      };
      expect(formatPeriodSubtitle(partialMonthInput)).toBe('01/08/2026 a 15/08/2026');

      const singleDayInput: EventoDocumentInput = {
        organizationName: 'Igreja Central',
        periodo: {
          dataInicio: '2026-08-15',
          dataFim: '2026-08-15',
        },
        eventos: [],
      };
      expect(formatPeriodSubtitle(singleDayInput)).toBe('15/08/2026');
      expect(getEventoPdfFileName(singleDayInput)).toBe('agenda-eventos-2026-08-15.pdf');
      expect(getEventoPdfFileName(partialMonthInput)).toBe('agenda-eventos-2026-08-01-a-2026-08-15.pdf');
      expect(getEventoPdfFileName(fullMonthInput)).toBe('agenda-eventos-2026-08.pdf');
      expect(getEventoPdfFileName({ organizationName: 'Igreja', eventos: [] })).toBe('agenda-eventos.pdf');
    });

    it('agrupa todos os eventos do mes por dia da semana sem duplicar cabecalhos de dias da semana entre paginas', async () => {
      // 5 Domingos em Agosto de 2026: 02, 09, 16, 23, 30
      // 4 Quartas em Agosto de 2026: 05, 12, 19, 26
      const augustEvents: EventoDocumentInput = {
        organizationName: 'Igreja Central',
        periodo: {
          dataInicio: '2026-08-01',
          dataFim: '2026-08-31',
        },
        eventos: [
          {
            id: 'dom-1',
            titulo: 'Culto Domingo 02',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-02T21:00:00.000Z'),
            dataFim: new Date('2026-08-02T23:00:00.000Z'),
            ministerios: [],
          },
          {
            id: 'qua-1',
            titulo: 'Culto Quarta 05',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-05T22:30:00.000Z'),
            dataFim: new Date('2026-08-06T00:00:00.000Z'),
            ministerios: [],
          },
          {
            id: 'dom-2',
            titulo: 'Culto Domingo 09',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-09T21:00:00.000Z'),
            dataFim: new Date('2026-08-09T23:00:00.000Z'),
            ministerios: [],
          },
          {
            id: 'qua-2',
            titulo: 'Culto Quarta 12',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-12T22:30:00.000Z'),
            dataFim: new Date('2026-08-13T00:00:00.000Z'),
            ministerios: [],
          },
          {
            id: 'dom-3',
            titulo: 'Culto Domingo 16',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-16T21:00:00.000Z'),
            dataFim: new Date('2026-08-16T23:00:00.000Z'),
            ministerios: [],
          },
          {
            id: 'qua-3',
            titulo: 'Culto Quarta 19',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-19T22:30:00.000Z'),
            dataFim: new Date('2026-08-20T00:00:00.000Z'),
            ministerios: [],
          },
          {
            id: 'dom-4',
            titulo: 'Culto Domingo 23',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-23T21:00:00.000Z'),
            dataFim: new Date('2026-08-23T23:00:00.000Z'),
            ministerios: [],
          },
          {
            id: 'qua-4',
            titulo: 'Culto Quarta 26',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-26T22:30:00.000Z'),
            dataFim: new Date('2026-08-27T00:00:00.000Z'),
            ministerios: [],
          },
          {
            id: 'dom-5',
            titulo: 'Culto Domingo 30',
            tipo: EventoTipo.GERAL,
            status: StatusEvento.AGENDADO,
            dataInicio: new Date('2026-08-30T21:00:00.000Z'),
            dataFim: new Date('2026-08-30T23:00:00.000Z'),
            ministerios: [],
          },
        ],
      };

      const mockPage = {
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('/Type /Page /Type /Page')),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const mockBrowser = {
        isConnected: () => true,
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

      const renderer = new EventoDocumentRendererService();
      const result = await renderer.renderExport(augustEvents, 'pdf', 1);

      expect(result.pageCount).toBe(2);

      const html = mockPage.setContent.mock.calls[0][0] as string;
      expect(html).toContain('Agosto de 2026');

      // domingos e quartas-feiras devem aparecer exatamente uma vez como título
      const domingosMatches = html.match(/<h2>domingos<\/h2>/gi);
      expect(domingosMatches).toHaveLength(1);

      const quartasMatches = html.match(/<h2>quartas-feiras<\/h2>/gi);
      expect(quartasMatches).toHaveLength(1);

      // Ordenação começando na segunda-feira: quartas-feiras devem vir antes de domingos
      const quartasIndex = html.toLowerCase().indexOf('<h2>quartas-feiras</h2>');
      const domingosIndex = html.toLowerCase().indexOf('<h2>domingos</h2>');
      expect(quartasIndex).toBeGreaterThan(-1);
      expect(domingosIndex).toBeGreaterThan(-1);
      expect(quartasIndex).toBeLessThan(domingosIndex);

      // Todos os 5 domingos devem estar presentes no HTML
      expect(html).toContain('Culto Domingo 02');
      expect(html).toContain('Culto Domingo 09');
      expect(html).toContain('Culto Domingo 16');
      expect(html).toContain('Culto Domingo 23');
      expect(html).toContain('Culto Domingo 30');
    });

    it('renderiza o rodape nativo do Playwright apenas com a marca One Elo / Lookup Labs (sem contagem de paginas)', () => {
      const footerHtml = renderPdfFooterTemplate('data:image/png;base64,sample');
      expect(footerHtml).toContain('One Elo');
      expect(footerHtml).toContain('Lookup Labs');
      expect(footerHtml).not.toContain('pageNumber');
      expect(footerHtml).not.toContain('totalPages');
      expect(footerHtml).toContain('data:image/png;base64,sample');
    });

    it('conta corretamente as paginas do buffer de PDF gerado', () => {
      const mockSingle = Buffer.from('%PDF-1.4 ... /Type /Page ... %%EOF');
      expect(countPdfPagesFromBuffer(mockSingle)).toBe(1);

      const mockMulti = Buffer.from('%PDF-1.4 ... /Type /Page ... /Type /Page ... /Type /Page ... %%EOF');
      expect(countPdfPagesFromBuffer(mockMulti)).toBe(3);
    });
  });

  it('rejeita com 503 (ExportServiceUnavailableException) quando a fila atinge o limite', async () => {
    let releaseFirstRender!: () => void;
    const firstRenderGate = new Promise<void>((resolve) => {
      releaseFirstRender = resolve;
    });

    const mockPage = {
      setContent: jest.fn(() => firstRenderGate),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('png-data')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isConnected: () => true,
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

    const renderer = new EventoDocumentRendererService();
    renderer.setLimitsForTesting({ maxQueueWaiting: 1 });

    const variantInput = (suffix: string): EventoDocumentInput => ({
      ...sampleInput,
      organizationName: `Igreja ${suffix}`,
    });

    const p1 = renderer.renderExport(variantInput('1'), 'png', 1);
    const p2 = renderer.renderExport(variantInput('2'), 'png', 1);

    await expect(
      renderer.renderExport(variantInput('3'), 'png', 1),
    ).rejects.toBeInstanceOf(ExportServiceUnavailableException);

    releaseFirstRender();
    await Promise.all([p1, p2]);
  });

  it('encerra o browser a forca e retorna 503 quando o timeout de renderizacao estoura', async () => {
    const closeSpy = jest.fn().mockResolvedValue(undefined);
    const neverEndingRender = new Promise<Buffer>(() => undefined);
    const mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      screenshot: jest.fn(() => neverEndingRender),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isConnected: () => true,
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: closeSpy,
    };
    jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

    const renderer = new EventoDocumentRendererService();
    renderer.setLimitsForTesting({ renderTimeoutMs: 40 });

    await expect(
      renderer.renderExport(sampleInput, 'png', 1),
    ).rejects.toBeInstanceOf(ExportServiceUnavailableException);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('rejeita com 400 quando a semana solicitada nao existe', async () => {
    const renderer = new EventoDocumentRendererService();
    await expect(
      renderer.renderExport(sampleInput, 'png', 99),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
