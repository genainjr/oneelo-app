import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';
import { ChromiumRendererService, TenantLogoService } from '../../../common/export';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { DocumentRenderResult } from '../document-worker.service';

export interface CarteirinhaMemberData {
  id: string;
  nome: string;
  nomeExibicao?: string | null;
  fotoUrl?: string | null;
  matricula?: string | null;
  cargo?: string | null;
  dataNascimento?: Date | null;
  dataBatismo?: Date | null;
  cpf?: string | null;
  rg?: string | null;
  sexo?: string | null;
  estadoCivil?: string | null;
  status: string;
}

export interface CarteirinhaTenantData {
  id: string;
  nome: string;
  logoUrl?: string | null;
  slug?: string;
}

@Injectable()
export class CarteirinhaRendererService {
  private readonly logger = new Logger(CarteirinhaRendererService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chromiumRenderer: ChromiumRendererService,
    private readonly tenantLogo: TenantLogoService,
    private readonly configService: ConfigService,
  ) {}

  private get webAppUrl(): string {
    const configured = this.configService.get<string>('WEB_APP_URL') || this.configService.get<string>('APP_URL');
    return (configured || 'https://app.oneelo.com.br').replace(/\/$/, '');
  }

  private formatDatePtBr(date?: Date | null): string {
    if (!date) return 'Não informado';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Não informado';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatCpf(cpf?: string | null): string {
    if (!cpf) return 'Não informado';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
    }
    return cpf;
  }

  private escape(str?: string | null): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async generateQrCodeDataUri(memberId: string): Promise<string> {
    const url = `${this.webAppUrl}/validar-carteirinha/${memberId}`;
    return QRCode.toDataURL(url, {
      margin: 1,
      width: 140,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  }

  renderCardHtml(
    member: CarteirinhaMemberData,
    tenant: CarteirinhaTenantData,
    tenantLogoDataUri: string | null,
    qrCodeDataUri: string,
    validadeAno: number,
  ): { frontHtml: string; backHtml: string } {
    const displayName = member.nomeExibicao || member.nome;
    const roleLabel = member.cargo || 'Membro';
    const birthDate = this.formatDatePtBr(member.dataNascimento);
    const baptismDate = this.formatDatePtBr(member.dataBatismo);
    const cpfFormatted = this.formatCpf(member.cpf);
    const matricula = member.matricula || `ROL-${member.id.slice(0, 6).toUpperCase()}`;
    const initials = displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');

    const photoHtml = member.fotoUrl
      ? `<img src="${this.escape(member.fotoUrl)}" alt="${this.escape(displayName)}" class="member-photo" />`
      : `<div class="member-photo-placeholder">${initials}</div>`;

    const churchLogoHtml = tenantLogoDataUri
      ? `<img src="${tenantLogoDataUri}" alt="${this.escape(tenant.nome)}" class="church-logo" />`
      : `<div class="church-name-text">${this.escape(tenant.nome)}</div>`;

    const frontHtml = `
      <div class="cr80-card card-front">
        <div class="card-header">
          <div class="header-left">
            ${churchLogoHtml}
          </div>
          <div class="header-badge">CARTEIRA DE MEMBRO</div>
        </div>

        <div class="card-body">
          <div class="photo-container">
            ${photoHtml}
          </div>
          <div class="member-info">
            <h1 class="member-name">${this.escape(displayName)}</h1>
            <p class="member-role">${this.escape(roleLabel)}</p>
            <div class="info-pill-container">
              <span class="info-pill">${this.escape(tenant.nome)}</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span class="footer-matricula">Matrícula: <strong>${this.escape(matricula)}</strong></span>
          <span class="footer-status">ATIVO</span>
        </div>
      </div>
    `;

    const backHtml = `
      <div class="cr80-card card-back">
        <div class="back-grid">
          <div class="back-details">
            <div class="detail-row">
              <span class="detail-label">Nome Completo</span>
              <strong class="detail-value text-ellipsis">${this.escape(member.nome)}</strong>
            </div>

            <div class="detail-cols-2">
              <div class="detail-row">
                <span class="detail-label">Nascimento</span>
                <strong class="detail-value">${birthDate}</strong>
              </div>
              <div class="detail-row">
                <span class="detail-label">Batismo</span>
                <strong class="detail-value">${baptismDate}</strong>
              </div>
            </div>

            <div class="detail-cols-2">
              <div class="detail-row">
                <span class="detail-label">CPF</span>
                <strong class="detail-value">${this.escape(cpfFormatted)}</strong>
              </div>
              <div class="detail-row">
                <span class="detail-label">RG</span>
                <strong class="detail-value">${this.escape(member.rg || 'Não informado')}</strong>
              </div>
            </div>

            <div class="detail-cols-2">
              <div class="detail-row">
                <span class="detail-label">Sexo</span>
                <strong class="detail-value">${member.sexo === 'FEMININO' ? 'Feminino' : member.sexo === 'MASCULINO' ? 'Masculino' : 'Não informado'}</strong>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado Civil</span>
                <strong class="detail-value">${this.escape(member.estadoCivil || 'Não informado')}</strong>
              </div>
            </div>

            <div class="detail-row">
              <span class="detail-label">Validade</span>
              <strong class="detail-value">31/12/${validadeAno}</strong>
            </div>
          </div>

          <div class="back-qr-col">
            <img src="${qrCodeDataUri}" alt="QR Autenticidade" class="qr-code" />
            <span class="qr-label">Autenticidade</span>
          </div>
        </div>

        <div class="back-footer">
          Documento eclesiástico emitido por OneElo · lookup.com.br
        </div>
      </div>
    `;

    return { frontHtml, backHtml };
  }

  getStyles(): string {
    return `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          background-color: #f8fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
        }

        .cr80-card {
          width: 85.6mm;
          height: 53.98mm;
          position: relative;
          background: #ffffff;
          border-radius: 3.5mm;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          page-break-inside: avoid;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 0.2mm solid #e2e8f0;
        }

        /* Frente */
        .card-front {
          background: linear-gradient(135deg, #ffffff 65%, #f1f5f9 100%);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 3mm 4mm 2mm 4mm;
          border-bottom: 0.3mm solid #e2e8f0;
          background: #fafafa;
        }

        .church-logo {
          max-height: 7mm;
          max-width: 38mm;
          object-fit: contain;
        }

        .church-name-text {
          font-size: 8pt;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
          max-width: 45mm;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-badge {
          background: #4f46e5;
          color: #ffffff;
          font-size: 5.5pt;
          font-weight: 800;
          letter-spacing: 0.4px;
          padding: 0.8mm 2.2mm;
          border-radius: 1.5mm;
          text-transform: uppercase;
        }

        .card-body {
          display: flex;
          align-items: center;
          gap: 3.5mm;
          padding: 2.5mm 4mm;
          flex: 1;
        }

        .photo-container {
          width: 20mm;
          height: 25mm;
          border-radius: 2mm;
          overflow: hidden;
          background: #e2e8f0;
          border: 0.3mm solid #cbd5e1;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .member-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .member-photo-placeholder {
          font-size: 14pt;
          font-weight: 800;
          color: #64748b;
        }

        .member-info {
          display: flex;
          flex-direction: column;
          gap: 1mm;
          overflow: hidden;
        }

        .member-name {
          font-size: 9.5pt;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.15;
          max-height: 7mm;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .member-role {
          font-size: 7pt;
          font-weight: 700;
          color: #4f46e5;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .info-pill-container {
          margin-top: 1mm;
        }

        .info-pill {
          display: inline-block;
          background: #e0e7ff;
          color: #3730a3;
          font-size: 5.5pt;
          font-weight: 700;
          padding: 0.5mm 2mm;
          border-radius: 1mm;
          max-width: 50mm;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 2mm 4mm;
          background: #f8fafc;
          border-top: 0.2mm solid #e2e8f0;
          font-size: 6pt;
          color: #64748b;
        }

        .footer-matricula strong {
          color: #0f172a;
        }

        .footer-status {
          background: #ecfdf5;
          color: #059669;
          font-weight: 800;
          padding: 0.5mm 1.5mm;
          border-radius: 1mm;
          border: 0.2mm solid #a7f3d0;
        }

        /* Verso */
        .card-back {
          background: #ffffff;
          padding: 3mm 4mm 2mm 4mm;
        }

        .back-grid {
          display: flex;
          gap: 2mm;
          flex: 1;
        }

        .back-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1mm;
        }

        .detail-row {
          display: flex;
          flex-direction: column;
        }

        .detail-cols-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2mm;
        }

        .detail-label {
          font-size: 4.8pt;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }

        .detail-value {
          font-size: 6.2pt;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.1;
        }

        .text-ellipsis {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 52mm;
        }

        .back-qr-col {
          width: 20mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-left: 0.2mm dashed #cbd5e1;
          padding-left: 2mm;
        }

        .qr-code {
          width: 17mm;
          height: 17mm;
          object-fit: contain;
        }

        .qr-label {
          font-size: 4.5pt;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 0.5mm;
          letter-spacing: 0.2px;
        }

        .back-footer {
          border-top: 0.2mm solid #f1f5f9;
          padding-top: 1mm;
          font-size: 4.5pt;
          color: #94a3b8;
          text-align: center;
        }

        /* Folha A4 Grade (Impressão em Lote) */
        .a4-sheet {
          width: 210mm;
          min-height: 297mm;
          padding: 10mm;
          display: grid;
          grid-template-columns: repeat(2, 85.6mm);
          gap: 8mm 10mm;
          justify-content: center;
          align-content: start;
          page-break-after: always;
          background: #ffffff;
        }
      </style>
    `;
  }

  async renderSingleCard(
    member: CarteirinhaMemberData,
    tenant: CarteirinhaTenantData,
    formato: 'PDF' | 'PNG',
  ): Promise<DocumentRenderResult> {
    const tenantLogoDataUri = await this.tenantLogo.resolveTenantLogoDataUri(tenant.logoUrl ?? undefined);
    const qrCodeDataUri = await this.generateQrCodeDataUri(member.id);
    const validadeAno = new Date().getFullYear() + 1;

    const { frontHtml, backHtml } = this.renderCardHtml(
      member,
      tenant,
      tenantLogoDataUri,
      qrCodeDataUri,
      validadeAno,
    );

    const safeMemberName = member.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-');

    return this.chromiumRenderer.runSerialRender(
      {
        eventName: 'carteirinha_render_single',
        format: formato.toLowerCase() as any,
        pageSelection: 1,
      },
      async (browser) => {
        const page = await browser.newPage({
          viewport: { width: 400, height: 600 },
          deviceScaleFactor: 2,
        });

        try {
          if (formato === 'PNG') {
            // No PNG, renderiza frente e verso lado a lado em alta resolução
            const fullHtml = `
              <!doctype html>
              <html>
              <head>
                <meta charset="utf-8" />
                ${this.getStyles()}
                <style>
                  body {
                    padding: 8mm;
                    background: transparent;
                    display: flex;
                    flex-direction: row;
                    gap: 6mm;
                  }
                  .cr80-card {
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                  }
                </style>
              </head>
              <body>
                ${frontHtml}
                ${backHtml}
              </body>
              </html>
            `;

            await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
            await this.chromiumRenderer.waitForImages(page);

            const buffer = await page.screenshot({ type: 'png', fullPage: true });

            return {
              buffer,
              fileName: `carteirinha-${safeMemberName}.png`,
              mimeType: 'image/png',
            };
          } else {
            // PDF em tamanho de cartão CR80 exato com 2 páginas (página 1: Frente, página 2: Verso)
            const fullHtml = `
              <!doctype html>
              <html>
              <head>
                <meta charset="utf-8" />
                ${this.getStyles()}
                <style>
                  @page {
                    size: 85.6mm 53.98mm;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                  }
                  .cr80-card {
                    border-radius: 0;
                    box-shadow: none;
                    border: none;
                  }
                </style>
              </head>
              <body>
                ${frontHtml}
                ${backHtml}
              </body>
              </html>
            `;

            await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
            await this.chromiumRenderer.waitForImages(page);

            const buffer = await page.pdf({
              width: '85.6mm',
              height: '53.98mm',
              printBackground: true,
              margin: { top: '0', right: '0', bottom: '0', left: '0' },
            });

            return {
              buffer,
              fileName: `carteirinha-${safeMemberName}.pdf`,
              mimeType: 'application/pdf',
            };
          }
        } finally {
          await page.close().catch(() => undefined);
        }
      },
    );
  }

  async renderBatchCardsA4(
    members: CarteirinhaMemberData[],
    tenant: CarteirinhaTenantData,
  ): Promise<DocumentRenderResult> {
    const tenantLogoDataUri = await this.tenantLogo.resolveTenantLogoDataUri(tenant.logoUrl ?? undefined);
    const validadeAno = new Date().getFullYear() + 1;

    // Gera pares de frente e verso para cada membro
    const renderedCards = await Promise.all(
      members.map(async (m) => {
        const qrCode = await this.generateQrCodeDataUri(m.id);
        return this.renderCardHtml(m, tenant, tenantLogoDataUri, qrCode, validadeAno);
      }),
    );

    // Na folha A4 cabem até 6 cartões por folha (3 linhas x 2 colunas)
    const CARDS_PER_PAGE = 6;
    const pagesHtml: string[] = [];

    for (let i = 0; i < renderedCards.length; i += CARDS_PER_PAGE) {
      const slice = renderedCards.slice(i, i + CARDS_PER_PAGE);

      // Página de Frentes
      const frentes = slice.map((c) => c.frontHtml).join('');
      pagesHtml.push(`<div class="a4-sheet">${frentes}</div>`);

      // Página de Versos (alinhados para impressão frente/verso)
      const versos = slice.map((c) => c.backHtml).join('');
      pagesHtml.push(`<div class="a4-sheet">${versos}</div>`);
    }

    const fullHtml = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        ${this.getStyles()}
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: #ffffff;
          }
          .cr80-card {
            border: 0.2mm dashed #94a3b8; /* Linha de corte */
          }
        </style>
      </head>
      <body>
        ${pagesHtml.join('')}
      </body>
      </html>
    `;

    return this.chromiumRenderer.runSerialRender(
      {
        eventName: 'carteirinha_render_batch',
        format: 'pdf',
        pageSelection: 1,
      },
      async (browser) => {
        const page = await browser.newPage({
          viewport: { width: 1200, height: 1600 },
          deviceScaleFactor: 1,
        });

        try {
          await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
          await this.chromiumRenderer.waitForImages(page);

          const buffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
          });

          return {
            buffer,
            fileName: `carteirinhas-lote-${tenant.slug || 'igreja'}-${new Date().toISOString().slice(0, 10)}.pdf`,
            mimeType: 'application/pdf',
          };
        } finally {
          await page.close().catch(() => undefined);
        }
      },
    );
  }
}
