import {
  FinancialPaymentMethod,
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '@prisma/client';
import { chromium } from 'playwright';
import { renderPdfFooterTemplate } from '../../../common/export';
import {
  FinanceiroDocumentRendererService,
  buildTransactionDetailSubline,
  formatFinanceiroCurrency,
  formatFinanceiroDateUtc,
  formatFinanceiroPeriodSubtitle,
  getFinanceiroPdfFileName,
  renderFinanceiroPdfHtml,
} from './financeiro-document-renderer.service';
import type { FinanceiroDocumentInput } from './financeiro-document.types';

function makeSampleInput(
  overrides: Partial<FinanceiroDocumentInput> = {},
): FinanceiroDocumentInput {
  return {
    tenantId: 'tenant-1',
    organizationName: 'Igreja Batista Central',
    logoUrl: null,
    issuedAt: new Date('2026-11-19T15:00:00.000Z'),
    periodo: {
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    },
    filters: {},
    appliedFilterLabels: [],
    items: [
      {
        id: 'tx-1',
        type: FinancialTransactionType.INCOME,
        status: FinancialTransactionStatus.CONFIRMED,
        date: new Date('2026-11-01T00:00:00.000Z'),
        paidAt: new Date('2026-11-01T00:00:00.000Z'),
        updatedAt: new Date('2026-11-01T12:00:00.000Z'),
        amount: 1250.5,
        description: 'Dízimo Mensal',
        paymentMethod: FinancialPaymentMethod.PIX,
        counterpartyName: 'João',
        installmentNumber: null,
        totalInstallments: null,
        account: { id: 'acc-1', name: 'Banco Principal' },
        category: { id: 'cat-1', name: 'Dízimos' },
        evento: { id: 'ev-1', titulo: 'Culto de Domingo' },
        member: { id: 'mem-1', nome: 'João Silva' },
      },
      {
        id: 'tx-2',
        type: FinancialTransactionType.EXPENSE,
        status: FinancialTransactionStatus.CANCELLED,
        date: new Date('2026-11-15T00:00:00.000Z'),
        paidAt: null,
        updatedAt: new Date('2026-11-15T12:00:00.000Z'),
        amount: 300,
        description: 'Compra Cancelada',
        paymentMethod: FinancialPaymentMethod.BOLETO,
        counterpartyName: 'Fornecedor Alpha',
        installmentNumber: 1,
        totalInstallments: 3,
        account: { id: 'acc-1', name: 'Banco Principal' },
        category: { id: 'cat-2', name: 'Manutenção' },
        evento: null,
        member: null,
      },
    ],
    totals: {
      count: 2,
      confirmedCount: 1,
      confirmedIncome: 1250.5,
      confirmedExpense: 0,
      confirmedNet: 1250.5,
      pendingCount: 0,
      pendingIncome: 0,
      pendingExpense: 0,
      pendingNet: 0,
      draftCount: 0,
      draftIncome: 0,
      draftExpense: 0,
      cancelledCount: 1,
      cancelledIncome: 0,
      cancelledExpense: 300,
    },
    truncated: false,
    totalMatchingCount: 2,
    ...overrides,
  };
}

describe('FinanceiroDocumentRendererService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formata datas estritamente em UTC sem deslocamento de -1 dia, valores pt-BR e nome do arquivo', () => {
    // 00:00Z no dia 01/11 seria 31/10 em America/Sao_Paulo se não usasse UTC
    expect(formatFinanceiroDateUtc(new Date('2026-11-01T00:00:00.000Z'))).toBe('01/11/2026');
    expect(formatFinanceiroDateUtc(null)).toBe('—');
    expect(formatFinanceiroCurrency(1250.5)).toContain('1.250,50');

    const monthInput = makeSampleInput();
    expect(formatFinanceiroPeriodSubtitle(monthInput)).toBe('Novembro de 2026');
    expect(getFinanceiroPdfFileName(monthInput)).toBe('extrato-financeiro-2026-11.pdf');

    const fallbackUtcInput = makeSampleInput({
      periodo: {},
    });
    expect(formatFinanceiroPeriodSubtitle(fallbackUtcInput)).toBe('01/11/2026 a 15/11/2026');
    expect(getFinanceiroPdfFileName(fallbackUtcInput)).toBe('extrato-financeiro-2026-11.pdf');
  });

  it('deduplica contraparte/membro e evento em buildTransactionDetailSubline e escapa HTML contra XSS', () => {
    const sample = makeSampleInput();
    const subline = buildTransactionDetailSubline(sample.items[0], 'Dízimo Mensal');
    expect(subline).toBe('João Silva · Evento: Culto de Domingo · Pix');

    // Quando o título já é o nome do evento, não deve repetir "Evento: ..."
    const sublineDedupEvento = buildTransactionDetailSubline(
      { ...sample.items[0], description: null, member: null, counterpartyName: null },
      'Culto de Domingo',
    );
    expect(sublineDedupEvento).toBe('Pix');

    const xssInput = makeSampleInput({
      organizationName: '<script>alert("org")</script>',
      appliedFilterLabels: [{ label: 'Busca', value: '<img src=x onerror=alert(1)>' }],
      items: [
        {
          ...sample.items[0],
          description: '<b>Oferta</b> & "Teste"',
          account: { id: 'a1', name: '<svg onload=alert(1)>' },
        },
      ],
    });
    const html = renderFinanceiroPdfHtml(xssInput, null);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<svg onload');
    expect(html).toContain('&lt;script&gt;alert(&quot;org&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;Oferta&lt;/b&gt; &amp; &quot;Teste&quot;');
  });

  it('renderiza cabeçalho limpo sem cards globais, filtros condicionais, estilo riscado em CANCELLED, paginação e totalização adaptativa', () => {
    const standardHtml = renderFinanceiroPdfHtml(makeSampleInput(), null);
    expect(standardHtml).toContain('Extrato Financeiro');
    expect(standardHtml).not.toContain('fin-filters-bar');
    expect(standardHtml).toContain('fin-row--cancelled');
    expect(standardHtml).toContain('fin-amount-cancelled');
    expect(standardHtml).toContain('Resultado (Confirmados)');
    expect(standardHtml).toContain('Cancelados fora do resultado (1)');

    // Filtro com chips + truncamento
    const filteredHtml = renderFinanceiroPdfHtml(
      makeSampleInput({
        appliedFilterLabels: [{ label: 'Tipo', value: 'Saída' }],
        truncated: true,
        totalMatchingCount: 720,
      }),
      null,
    );
    expect(filteredHtml).toContain('fin-filters-bar');
    expect(filteredHtml).toContain('Tipo:');
    expect(filteredHtml).toContain('Exibindo os 2 lançamentos mais recentes de 720 encontrados');

    // Filtro exclusivo CANCELLED
    const cancelledHtml = renderFinanceiroPdfHtml(
      makeSampleInput({
        filters: { status: FinancialTransactionStatus.CANCELLED },
        totals: {
          count: 1,
          confirmedCount: 0,
          confirmedIncome: 0,
          confirmedExpense: 0,
          confirmedNet: 0,
          pendingCount: 0,
          pendingIncome: 0,
          pendingExpense: 0,
          pendingNet: 0,
          draftCount: 0,
          draftIncome: 0,
          draftExpense: 0,
          cancelledCount: 1,
          cancelledIncome: 0,
          cancelledExpense: 300,
        },
      }),
      null,
    );
    expect(cancelledHtml).toContain('Total Listado (Cancelados — não contabilizados no resultado)');
    expect(cancelledHtml).not.toContain('Resultado (Confirmados)');

    // Filtro exclusivo PENDING
    const pendingHtml = renderFinanceiroPdfHtml(
      makeSampleInput({
        filters: { status: FinancialTransactionStatus.PENDING },
        totals: {
          count: 2,
          confirmedCount: 0,
          confirmedIncome: 0,
          confirmedExpense: 0,
          confirmedNet: 0,
          pendingCount: 2,
          pendingIncome: 500,
          pendingExpense: 200,
          pendingNet: 300,
          draftCount: 0,
          draftIncome: 0,
          draftExpense: 0,
          cancelledCount: 0,
          cancelledIncome: 0,
          cancelledExpense: 0,
        },
      }),
      null,
    );
    expect(pendingHtml).toContain('Total dos Lançamentos Pendentes Listados');
    expect(pendingHtml).toContain('A Receber (Pendente)');
    expect(pendingHtml).toContain('Saldo Previsto (Pendentes)');

    // Rodapé com paginação ativada
    const footerWithPages = renderPdfFooterTemplate(null, { showPageNumbers: true });
    expect(footerWithPages).toContain('pageNumber');
    expect(footerWithPages).toContain('totalPages');
    expect(footerWithPages).toContain('One Elo');
  });

  it('gera ETag sensível a tenantId, issuedDateKey e paidAt e retorna 304 Not Modified sem iniciar Chromium', async () => {
    const launchSpy = jest.spyOn(chromium, 'launch');
    const renderer = new FinanceiroDocumentRendererService();
    const baseInput = makeSampleInput();

    const etag1 = renderer.computeEtag(baseInput);
    const etagDiffTenant = renderer.computeEtag({ ...baseInput, tenantId: 'tenant-2' });
    const etagNextDay = renderer.computeEtag({
      ...baseInput,
      issuedAt: new Date('2026-11-20T15:00:00.000Z'),
    });
    const etagPaidAtChanged = renderer.computeEtag({
      ...baseInput,
      items: [
        { ...baseInput.items[0], paidAt: new Date('2026-11-02T00:00:00.000Z') },
        baseInput.items[1],
      ],
    });

    expect(etag1).not.toBe(etagDiffTenant);
    expect(etag1).not.toBe(etagNextDay);
    expect(etag1).not.toBe(etagPaidAtChanged);

    const notModified = await renderer.renderPdf(baseInput, { ifNoneMatch: etag1 });
    expect(notModified).toEqual({
      kind: 'not-modified',
      etag: etag1,
      pageCount: 1,
      notModified: true,
    });
    expect(launchSpy).not.toHaveBeenCalled();
  });

  it('renderiza PDF em A4 paisagem com paginação no rodapé e reutiliza cache LRU em chamadas repetidas', async () => {
    const fakePdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n2 0 obj << /Type /Page >> endobj\n%%EOF',
      'latin1',
    );
    const mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(fakePdfBuffer),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isConnected: jest.fn().mockReturnValue(true),
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const launchSpy = jest
      .spyOn(chromium, 'launch')
      .mockResolvedValue(mockBrowser as any);

    const renderer = new FinanceiroDocumentRendererService();
    const input = makeSampleInput();

    const first = await renderer.renderPdf(input);
    expect(first.kind).toBe('single');
    if (first.kind === 'single') {
      expect(first.mimeType).toBe('application/pdf');
      expect(first.fileName).toBe('extrato-financeiro-2026-11.pdf');
      expect(first.pageCount).toBe(2);
      expect(first.etag).toBeTruthy();
      expect(first.buffer).toEqual(fakePdfBuffer);
    }

    expect(mockBrowser.newPage).toHaveBeenCalledWith(
      expect.objectContaining({ viewport: { width: 1123, height: 794 } }),
    );
    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        landscape: true,
        displayHeaderFooter: true,
        footerTemplate: expect.stringContaining('pageNumber'),
      }),
    );

    // Segunda chamada com mesmos dados deve usar cache LRU sem relançar Chromium
    const second = await renderer.renderPdf(input);
    expect(second).toEqual(first);
    expect(launchSpy).toHaveBeenCalledTimes(1);
  });
});
