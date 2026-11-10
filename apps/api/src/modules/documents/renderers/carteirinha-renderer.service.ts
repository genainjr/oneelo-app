import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
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

let cachedMetallicBgDataUri: string | null = null;

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
    const configured =
      this.configService.get<string>('WEB_APP_URL') ||
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('FRONTEND_URL');
    if (configured && !configured.includes('localhost')) {
      return configured.replace(/\/$/, '');
    }
    if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
      return 'https://app.oneelo.com.br';
    }
    return configured ? configured.replace(/\/$/, '') : 'http://localhost:3001';
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

  private formatEstadoCivil(estadoCivil?: string | null, sexo?: string | null): string {
    if (!estadoCivil) return 'Não informado';
    const clean = estadoCivil.trim().toUpperCase();
    const isFeminino = sexo === 'FEMININO';

    switch (clean) {
      case 'SOLTEIRO':
      case 'SOLTEIRA':
        return isFeminino ? 'Solteira' : 'Solteiro';
      case 'CASADO':
      case 'CASADA':
        return isFeminino ? 'Casada' : 'Casado';
      case 'DIVORCIADO':
      case 'DIVORCIADA':
        return isFeminino ? 'Divorciada' : 'Divorciado';
      case 'VIUVO':
      case 'VIUVA':
      case 'VIÚVO':
      case 'VIÚVA':
        return isFeminino ? 'Viúva' : 'Viúvo';
      case 'UNIAO_ESTAVEL':
      case 'UNIÃO_ESTÁVEL':
      case 'UNIAO ESTAVEL':
      case 'UNIÃO ESTÁVEL':
        return 'União Estável';
      default:
        return estadoCivil;
    }
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

  getValidationUrl(memberId: string): string {
    return `${this.webAppUrl}/validar-carteirinha/${memberId}`;
  }

  async generateQrCodeDataUri(memberId: string, customValidationUrl?: string): Promise<string> {
    const url = customValidationUrl || this.getValidationUrl(memberId);
    return QRCode.toDataURL(url, {
      margin: 3,
      width: 400,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }

  async resolveMemberPhotoDataUri(fotoUrl?: string | null): Promise<string | null> {
    if (!fotoUrl) return null;
    const trimmed = fotoUrl.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (!/^https?:\/\//i.test(trimmed)) return null;

    try {
      const response = await fetch(trimmed, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 10 * 1024 * 1024) return null;

      const rawBuffer = Buffer.from(arrayBuffer);
      // O espaço da foto no cartão CR80 é de apenas 22mm x 28mm (~130x165 px).
      // Redimensionar para 240x300 JPEG (quality 80) reduz o consumo de RAM de dezenas de MB para ~12KB por foto.
      const optimizedBuffer = await sharp(rawBuffer, { failOnError: false })
        .rotate()
        .resize(240, 300, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 80 })
        .toBuffer();

      return `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;
    } catch (err) {
      this.logger.warn(
        `Falha ao resolver foto do membro para carteirinha: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  renderCardHtml(
    member: CarteirinhaMemberData,
    tenant: CarteirinhaTenantData,
    tenantLogoDataUri: string | null,
    qrCodeDataUri: string,
    validadeAno: number,
    memberPhotoDataUri?: string | null,
    validationUrl?: string,
  ): { frontHtml: string; backHtml: string } {
    const displayName = member.nomeExibicao || member.nome;
    const roleLabel = member.cargo || 'Membro';
    const birthDate = this.formatDatePtBr(member.dataNascimento);
    const baptismDate = this.formatDatePtBr(member.dataBatismo);
    const cpfFormatted = this.formatCpf(member.cpf);
    const estadoCivilFormatted = this.formatEstadoCivil(member.estadoCivil, member.sexo);
    const matricula = member.matricula || `ROL-${member.id.slice(0, 6).toUpperCase()}`;
    const targetValidationUrl = validationUrl || this.getValidationUrl(member.id);
    const initials = displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');

    const resolvedPhotoSrc = memberPhotoDataUri || member.fotoUrl;
    const photoHtml = resolvedPhotoSrc
      ? `<img src="${this.escape(resolvedPhotoSrc)}" alt="${this.escape(displayName)}" class="member-photo" />`
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
          <div class="header-badge">Carteira de Membro</div>
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
        </div>
      </div>
    `;

    const backHtml = `
      <div class="cr80-card card-back">
        <div class="back-grid">
          <div class="back-details">
            <div class="detail-row">
              <span class="detail-label">Nome Completo</span>
              <strong class="detail-value name-highlight">${this.escape(member.nome)}</strong>
            </div>

            <div class="detail-cols-2">
              <div class="detail-row">
                <span class="detail-label">Nascimento</span>
                <span class="detail-value">${birthDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Batismo</span>
                <span class="detail-value">${baptismDate}</span>
              </div>
            </div>

            <div class="detail-cols-2">
              <div class="detail-row">
                <span class="detail-label">CPF</span>
                <span class="detail-value">${this.escape(cpfFormatted)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado Civil</span>
                <span class="detail-value">${this.escape(estadoCivilFormatted)}</span>
              </div>
            </div>

            <div class="detail-row">
              <span class="detail-label">Validade</span>
              <strong class="detail-value date-highlight">31/12/${validadeAno}</strong>
            </div>
          </div>

          <div class="back-qr-col">
            <a href="${targetValidationUrl}" target="_blank" class="qr-link" title="Validar autenticidade da carteirinha">
              <img src="${qrCodeDataUri}" alt="QR Autenticidade" class="qr-code" />
              <span class="qr-label">Validar ↗</span>
            </a>
          </div>
        </div>

        <div class="back-footer">
          Documento emitido por OneElo • <a href="${targetValidationUrl}" target="_blank" class="footer-link">lookuplabs.com.br</a>
        </div>
      </div>
    `;

    return { frontHtml, backHtml };
  }

  getMetallicBgDataUri(): string {
    if (cachedMetallicBgDataUri) {
      return cachedMetallicBgDataUri;
    }

    const candidatePaths = [
      join(process.cwd(), 'assets/carteirinha-metallic-bg.png'),
      join(process.cwd(), 'apps/api/assets/carteirinha-metallic-bg.png'),
      join(__dirname, '../../../../assets/carteirinha-metallic-bg.png'),
      join(__dirname, '../../assets/carteirinha-metallic-bg.png'),
    ];

    for (const filePath of candidatePaths) {
      try {
        if (existsSync(filePath)) {
          const buffer = readFileSync(filePath);
          cachedMetallicBgDataUri = `data:image/png;base64,${buffer.toString('base64')}`;
          return cachedMetallicBgDataUri;
        }
      } catch {
        // ignore and try next candidate
      }
    }

    return '';
  }

  getStyles(): string {
    const bgDataUri = this.getMetallicBgDataUri();
    const frontBgCss = bgDataUri
      ? `background-color: #f1f5f9; background-image: url('${bgDataUri}'); background-repeat: no-repeat; background-position: center; background-size: cover;`
      : 'background: linear-gradient(135deg, #ffffff 15%, #f1f5f9 45%, #cbd5e1 75%, #94a3b8 100%);';
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
          background-color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
        }

        .cr80-card {
          width: 495px;
          min-width: 495px;
          max-width: 495px;
          height: 312px;
          min-height: 312px;
          max-height: 312px;
          flex-shrink: 0;
          position: relative;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: none;
          page-break-inside: avoid;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1px solid rgba(226, 232, 240, 0.7);
          padding: 20px;
        }

        /* Frente */
        .card-front {
          ${frontBgCss}
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 9px;
          border-bottom: 1.5px solid #f1f5f9;
        }

        .header-left {
          display: flex;
          align-items: center;
          max-width: 270px;
        }

        .church-logo {
          max-height: 36px;
          max-width: 135px;
          object-fit: contain;
        }

        .church-name-text {
          font-size: 17px;
          font-weight: 900;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: -0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-badge {
          background: #4f46e5;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 900;
          letter-spacing: 0.6px;
          padding: 3px 12px;
          border-radius: 8px;
          text-transform: uppercase;
        }

        .card-body {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-top: auto;
          margin-bottom: auto;
        }

        .photo-container {
          width: 84px;
          height: 96px;
          border-radius: 18px;
          overflow: hidden;
          background: #e2e8f0;
          border: 1.5px solid #cbd5e1;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .member-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .member-photo-placeholder {
          font-size: 24px;
          font-weight: 800;
          color: #94a3b8;
        }

        .member-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow: hidden;
          flex: 1;
          min-width: 0;
        }

        .member-name {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .member-role {
          font-size: 17px;
          font-weight: 700;
          color: #4f46e5;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .info-pill-container {
          margin-top: 3px;
        }

        .info-pill {
          display: inline-block;
          background: #eef2ff;
          border: 1.5px solid #e0e7ff;
          color: #4338ca;
          font-size: 13.5px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 6px;
          max-width: 260px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-footer {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding-top: 9px;
          border-top: 1.5px solid #f1f5f9;
          font-size: 14px;
          color: #64748b;
        }

        .footer-matricula strong {
          color: #1e293b;
          font-weight: 700;
        }

        /* Verso */
        .card-back {
          background: #ffffff;
        }

        .back-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 12px;
          height: 100%;
        }

        .back-details {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding-top: 3px;
          padding-bottom: 3px;
        }

        .detail-row {
          display: flex;
          flex-direction: column;
        }

        .detail-label {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 700;
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 3px;
        }

        .detail-value {
          font-size: 13.5px;
          color: #334155;
          font-weight: 600;
          line-height: 1.2;
        }

        .detail-value.name-highlight {
          font-size: 15.5px;
          color: #1e293b;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .detail-value.date-highlight {
          font-size: 14px;
          color: #1e293b;
          font-weight: 700;
        }

        .detail-cols-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .back-qr-col {
          border-left: 1.5px dashed #e2e8f0;
          padding-left: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .qr-link {
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .qr-code {
          width: 96px;
          height: 96px;
          object-fit: contain;
          display: block;
        }

        .qr-label {
          font-size: 11px;
          font-weight: 700;
          color: #4f46e5;
          text-transform: uppercase;
          letter-spacing: -0.2px;
          margin-top: 4px;
        }

        .back-footer {
          padding-top: 9px;
          border-top: 1.5px solid #f1f5f9;
          text-align: center;
          font-size: 11.5px;
          color: #94a3b8;
        }

        .footer-link {
          color: #6366f1;
          text-decoration: none;
          font-weight: 600;
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
    _formato?: 'PDF' | 'PNG' | string,
    customValidationUrl?: string,
  ): Promise<DocumentRenderResult> {
    const tenantLogoDataUri = await this.tenantLogo.resolveTenantLogoDataUri(tenant.logoUrl ?? undefined);
    const memberPhotoDataUri = await this.resolveMemberPhotoDataUri(member.fotoUrl ?? undefined);
    const qrCodeDataUri = await this.generateQrCodeDataUri(member.id, customValidationUrl);
    const validadeAno = new Date().getFullYear() + 1;
    const validationUrl = customValidationUrl || this.getValidationUrl(member.id);

    const { frontHtml, backHtml } = this.renderCardHtml(
      member,
      tenant,
      tenantLogoDataUri,
      qrCodeDataUri,
      validadeAno,
      memberPhotoDataUri,
      validationUrl,
    );

    const safeMemberName = member.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-');

    return this.chromiumRenderer.runSerialRender(
      {
        eventName: 'carteirinha_render_single',
        format: 'pdf',
        pageSelection: 1,
      },
      async (browser) => {
        const page = await browser.newPage({
          viewport: { width: 1080, height: 380 },
          deviceScaleFactor: 2,
        });

        try {
          const fullHtml = `
            <!doctype html>
            <html>
            <head>
              <meta charset="utf-8" />
              ${this.getStyles()}
              <style>
                @page {
                  size: 1068px 360px;
                  margin: 0;
                }
                html, body {
                  margin: 0;
                  padding: 0;
                  width: 1068px;
                  height: 360px;
                  background: #ffffff !important;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                #cards-wrapper {
                  display: flex;
                  flex-direction: row;
                  gap: 30px;
                  align-items: center;
                  justify-content: center;
                  background: #ffffff;
                }
                .cr80-card {
                  box-shadow: none !important;
                  border-radius: 16px;
                  border: 1px solid rgba(226, 232, 240, 0.7);
                }
              </style>
            </head>
            <body>
              <div id="cards-wrapper">
                ${frontHtml}
                ${backHtml}
              </div>
            </body>
            </html>
          `;

          await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
          await this.chromiumRenderer.waitForImages(page);

          const buffer = await page.pdf({
            width: '1068px',
            height: '360px',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          });

          return {
            buffer,
            fileName: `carteirinha-${safeMemberName}.pdf`,
            mimeType: 'application/pdf',
          };
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

    // Gera pares de frente e verso processando em pequenos lotes (chunk de 3)
    // para evitar concorrência excessiva de descompressão de fotos na RAM do container
    const renderedCards: { frontHtml: string; backHtml: string }[] = [];
    const CHUNK_SIZE = 3;

    for (let i = 0; i < members.length; i += CHUNK_SIZE) {
      const chunk = members.slice(i, i + CHUNK_SIZE);
      const chunkCards = await Promise.all(
        chunk.map(async (m) => {
          const qrCode = await this.generateQrCodeDataUri(m.id);
          const memberPhotoDataUri = await this.resolveMemberPhotoDataUri(m.fotoUrl ?? undefined);
          return this.renderCardHtml(m, tenant, tenantLogoDataUri, qrCode, validadeAno, memberPhotoDataUri);
        }),
      );
      renderedCards.push(...chunkCards);
    }

    // Na folha A4 padrão cabem 8 cartões no formato CR80 (4 linhas x 2 colunas)
    const CARDS_PER_PAGE = 8;
    const pagesHtml: string[] = [];

    for (let i = 0; i < renderedCards.length; i += CARDS_PER_PAGE) {
      const slice = renderedCards.slice(i, i + CARDS_PER_PAGE);

      const frontSlots: string[] = [];
      const backSlots: string[] = [];

      for (let row = 0; row < 4; row++) {
        const leftIdx = row * 2;
        const rightIdx = row * 2 + 1;

        const leftCard = slice[leftIdx];
        const rightCard = slice[rightIdx];

        // Frente da folha: Coluna 1 = leftCard, Coluna 2 = rightCard
        frontSlots.push(
          leftCard ? leftCard.frontHtml : '<div class="card-placeholder"></div>',
        );
        frontSlots.push(
          rightCard ? rightCard.frontHtml : '<div class="card-placeholder"></div>',
        );

        // Verso da folha: Mantém rigorosamente a mesma ordem da frente
        // Coluna 1 = verso do leftCard, Coluna 2 = verso do rightCard
        backSlots.push(
          leftCard ? leftCard.backHtml : '<div class="card-placeholder"></div>',
        );
        backSlots.push(
          rightCard ? rightCard.backHtml : '<div class="card-placeholder"></div>',
        );
      }

      pagesHtml.push(`<div class="a4-sheet">${frontSlots.join('')}</div>`);
      pagesHtml.push(`<div class="a4-sheet">${backSlots.join('')}</div>`);
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
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            width: 210mm;
          }
          body {
            display: block !important;
          }
          .a4-sheet {
            width: 210mm;
            height: 297mm;
            max-height: 297mm;
            box-sizing: border-box;
            padding: 20mm 16.4mm;
            display: grid;
            grid-template-columns: 85.6mm 85.6mm;
            grid-template-rows: repeat(4, 53.98mm);
            column-gap: 6mm;
            row-gap: 4mm;
            justify-content: center;
            align-content: center;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }
          .a4-sheet:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .a4-sheet .cr80-card {
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0.25mm dashed #94a3b8 !important; /* Linha de corte precisa */
          }
          .card-placeholder {
            width: 85.6mm;
            height: 53.98mm;
            visibility: hidden;
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
