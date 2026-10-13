import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const startedAt = performance.now();
const outputDirectory = await mkdtemp(join(tmpdir(), 'oneelo-playwright-renderer-'));

const scheduleRows = Array.from(
  { length: 24 },
  (_, index) => `
    <tr>
      <td>${String(index + 1).padStart(2, '0')}/10</td>
      <td>${index % 7 === 0 ? 'Domingo' : 'Quarta-feira'}</td>
      <td>Equipe de Louvor</td>
      <td>Maria Silva, Joao Santos e Ana Souza</td>
    </tr>`,
);

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; }
      .page { min-height: 186mm; break-after: page; }
      .page:last-child { break-after: auto; }
      header { align-items: center; border-bottom: 1px solid #d1d5db; display: flex; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; }
      .logo { align-items: center; background: #1d4ed8; border-radius: 8px; color: white; display: flex; font-weight: 700; height: 40px; justify-content: center; width: 40px; }
      h1 { font-size: 20px; margin: 0; }
      p { color: #6b7280; font-size: 12px; margin: 4px 0 0; }
      table { border-collapse: collapse; font-size: 11px; width: 100%; }
      th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #eff6ff; font-weight: 700; }
      tbody tr:nth-child(even) { background: #f9fafb; }
      footer { color: #6b7280; font-size: 10px; margin-top: 12px; text-align: right; }
    </style>
  </head>
  <body>
    <section class="page">
      <header><div class="logo">OE</div><div><h1>Escala de Louvor - Outubro 2026</h1><p>Igreja One Elo · Primeira pagina do spike</p></div></header>
      <table><thead><tr><th>Data</th><th>Dia</th><th>Ministerio</th><th>Escalados</th></tr></thead><tbody>${scheduleRows.slice(0, Math.ceil(scheduleRows.length / 2)).join('')}</tbody></table>
      <footer>One Elo · Documento de validacao do renderer</footer>
    </section>
    <section class="page">
      <header><div class="logo">OE</div><div><h1>Escala de Louvor - Outubro 2026</h1><p>Igreja One Elo · Segunda pagina do spike</p></div></header>
      <table><thead><tr><th>Data</th><th>Dia</th><th>Ministerio</th><th>Escalados</th></tr></thead><tbody>${scheduleRows.slice(Math.ceil(scheduleRows.length / 2)).join('')}</tbody></table>
      <footer>One Elo · Documento de validacao do renderer</footer>
    </section>
  </body>
</html>`;

const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    viewport: { width: 1123, height: 794 },
    deviceScaleFactor: 2,
  });

  await page.setContent(html, { waitUntil: 'load' });

  const pdf = await page.pdf({
    format: 'A4',
    landscape: true,
    preferCSSPageSize: true,
    printBackground: true,
  });

  await writeFile(join(outputDirectory, 'escala-spike.pdf'), pdf);

  const documentPages = page.locator('.page');
  const pageCount = await documentPages.count();
  const pngPaths = [];

  for (let index = 0; index < pageCount; index += 1) {
    const path = join(outputDirectory, `escala-spike-${String(index + 1).padStart(2, '0')}.png`);
    await documentPages.nth(index).screenshot({ path, type: 'png' });
    pngPaths.push(path);
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const memory = process.memoryUsage();

  console.log(
    JSON.stringify(
      {
        outputDirectory,
        pdf: join(outputDirectory, 'escala-spike.pdf'),
        pngPaths,
        durationMs,
        rssMiB: Number((memory.rss / 1024 / 1024).toFixed(1)),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
