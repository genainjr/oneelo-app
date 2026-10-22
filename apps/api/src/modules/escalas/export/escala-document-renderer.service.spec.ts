import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { chromium } from 'playwright';
import { ExportEscalaDto } from '../dto/export-escala.dto';
import {
  CHROMIUM_LOW_MEMORY_ARGS,
  EscalaDocumentRendererService,
  ExportServiceUnavailableException,
  getEscalaPdfFileName,
  listWeeklyPageOptions,
} from './escala-document-renderer.service';
import type { EscalaDocumentInput } from './escala-document.types';

const sampleInput: EscalaDocumentInput = {
  organizationName: 'Igreja Batista Central',
  logoUrl: null,
  schedules: [
    {
      id: 'esc-1',
      ministryName: 'Ministério de Louvor',
      month: 10,
      year: 2026,
      roles: [
        { id: 'r1', name: 'Ministro' },
        { id: 'r2', name: 'Teclado' },
      ],
      days: [
        {
          date: new Date('2026-10-01T00:00:00.000Z'),
          title: 'Culto de Quinta',
          hiddenRoleIds: [],
          assignments: [{ roleId: 'r1', memberName: 'Ana' }],
        },
        {
          date: new Date('2026-10-11T00:00:00.000Z'),
          title: 'Culto de Domingo',
          hiddenRoleIds: [],
          assignments: [{ roleId: 'r2', memberName: 'Carlos' }],
        },
      ],
    },
  ],
};

describe('ExportEscalaDto', () => {
  it('aceita pagina numerica e pagina="todas"', () => {
    const numericDto = plainToInstance(ExportEscalaDto, {
      formato: 'png',
      pagina: '2',
    });
    expect(validateSync(numericDto)).toHaveLength(0);
    expect(numericDto.pagina).toBe(2);

    const batchDto = plainToInstance(ExportEscalaDto, {
      formato: 'png',
      pagina: 'todas',
    });
    expect(validateSync(batchDto)).toHaveLength(0);
    expect(batchDto.pagina).toBe('todas');
  });

  it('rejeita pagina invalida', () => {
    const invalidZero = plainToInstance(ExportEscalaDto, {
      formato: 'png',
      pagina: '0',
    });
    expect(validateSync(invalidZero).length).toBeGreaterThan(0);

    const invalidText = plainToInstance(ExportEscalaDto, {
      formato: 'png',
      pagina: 'invalida',
    });
    expect(validateSync(invalidText).length).toBeGreaterThan(0);
  });
});

describe('EscalaDocumentRendererService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lista as semanas disponiveis seguindo a regra de createWeeklyPages', () => {
    const options = listWeeklyPageOptions(sampleInput.schedules);
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      page: 1,
      weekStart: '2026-09-28',
      weekEnd: '2026-10-04',
      label: 'Semana de 01 a 04 de outubro',
      fileName: 'escalas-semana-2026-10-01.png',
      eventCount: 1,
    });
    expect(options[1]).toMatchObject({
      page: 2,
      weekStart: '2026-10-05',
      weekEnd: '2026-10-11',
      label: 'Semana de 05 a 11 de outubro',
      fileName: 'escalas-semana-2026-10-05.png',
      eventCount: 1,
    });
  });

  it('gera ETag deterministica e responde not-modified sem iniciar o Chromium quando If-None-Match coincide', async () => {
    const launchSpy = jest.spyOn(chromium, 'launch');
    const renderer = new EscalaDocumentRendererService();
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

    const changedInput: EscalaDocumentInput = {
      ...sampleInput,
      schedules: [
        {
          ...sampleInput.schedules[0],
          ministryName: 'Outro Ministério',
        },
      ],
    };
    expect(renderer.computeEtag(changedInput, 'png', 1)).not.toBe(etag);
  });

  it('passa flags de baixa memoria, bloqueia rede externa, suporta lote PNG em 1 launch e reutiliza cache em memoria', async () => {
    const mockPage = {
      route: jest.fn().mockResolvedValue(undefined),
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

    const renderer = new EscalaDocumentRendererService();
    const batchResult = await renderer.renderExport(sampleInput, 'png', 'todas');

    expect(launchSpy).toHaveBeenCalledTimes(1);
    expect(launchSpy).toHaveBeenCalledWith({
      headless: true,
      args: CHROMIUM_LOW_MEMORY_ARGS,
    });
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
    expect(mockPage.setContent).toHaveBeenCalledTimes(2);
    expect(mockPage.setContent.mock.calls[0][0]).toContain(
      "Content-Security-Policy",
    );
    expect(batchResult.kind).toBe('batch');
    if (batchResult.kind === 'batch') {
      expect(batchResult.pageCount).toBe(2);
      expect(batchResult.files).toEqual([
        {
          fileName: 'escalas-semana-2026-10-01.png',
          mimeType: 'image/png',
          base64: Buffer.from('png-week-1').toString('base64'),
        },
        {
          fileName: 'escalas-semana-2026-10-05.png',
          mimeType: 'image/png',
          base64: Buffer.from('png-week-2').toString('base64'),
        },
      ]);
    }

    // Segunda chamada com os mesmos dados deve vir do cache sem abrir novo browser
    const cachedBatchResult = await renderer.renderExport(
      sampleInput,
      'png',
      'todas',
    );
    expect(launchSpy).toHaveBeenCalledTimes(1);
    expect(cachedBatchResult).toEqual(batchResult);
  });

  it('rejeita com 503 (ExportServiceUnavailableException) quando a fila atinge o limite', async () => {
    let releaseFirstRender!: () => void;
    const firstRenderGate = new Promise<void>((resolve) => {
      releaseFirstRender = resolve;
    });

    const mockPage = {
      route: jest.fn().mockResolvedValue(undefined),
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

    const renderer = new EscalaDocumentRendererService();
    renderer.setLimitsForTesting({ maxQueueWaiting: 1 });

    const variantInput = (suffix: string): EscalaDocumentInput => ({
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
      route: jest.fn().mockResolvedValue(undefined),
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

    const renderer = new EscalaDocumentRendererService();
    renderer.setLimitsForTesting({ renderTimeoutMs: 40 });

    await expect(
      renderer.renderExport(sampleInput, 'png', 1),
    ).rejects.toBeInstanceOf(ExportServiceUnavailableException);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('rejeita com 400 quando a semana solicitada nao existe', async () => {
    const renderer = new EscalaDocumentRendererService();
    await expect(
      renderer.renderExport(sampleInput, 'png', 99),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('embute logo do tenant maior que 512 KB (ate 5 MB) como data URI no HTML', async () => {
    const mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('png-with-logo')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isConnected: () => true,
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

    const largeLogoBuffer = Buffer.alloc(900 * 1024, 1);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (header: string) =>
          header.toLowerCase() === 'content-type' ? 'image/png' : null,
      },
      arrayBuffer: async () =>
        largeLogoBuffer.buffer.slice(
          largeLogoBuffer.byteOffset,
          largeLogoBuffer.byteOffset + largeLogoBuffer.byteLength,
        ),
    } as any);

    const renderer = new EscalaDocumentRendererService();
    await renderer.renderExport(
      {
        ...sampleInput,
        logoUrl: 'https://example.supabase.co/storage/v1/object/public/tenant-logos/logo.png',
      },
      'png',
      1,
    );

    const html = mockPage.setContent.mock.calls[0][0] as string;
    expect(html).toContain('class="tenant-logo" src="data:image/png;base64,');
  });

  it('gera nome de arquivo PDF identificando o periodo (ex: escalas-2026-10.pdf) e renderiza subtitulo no header', async () => {
    expect(getEscalaPdfFileName(sampleInput.schedules)).toBe('escalas-2026-10.pdf');
    expect(getEscalaPdfFileName([])).toBe('escalas.pdf');

    const mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isConnected: () => true,
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

    const renderer = new EscalaDocumentRendererService();
    const result = await renderer.renderExport(sampleInput, 'pdf', 1);

    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.fileName).toBe('escalas-2026-10.pdf');
    }
    const html = mockPage.setContent.mock.calls[0][0] as string;
    expect(html).toContain('<p class="header-subtitle">Outubro de 2026</p>');
    expect(html).toContain('Emitido em ');
  });
});
