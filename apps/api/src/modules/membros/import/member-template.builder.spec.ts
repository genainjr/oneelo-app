import ExcelJS from 'exceljs';
import {
  buildMemberImportTemplateBuffer,
  MEMBER_IMPORT_COLUMNS,
} from './member-template.builder';

describe('MemberTemplateBuilder', () => {
  it('deve gerar buffer XLSX válido com cabeçalhos e validações corretas', async () => {
    const buffer = await buildMemberImportTemplateBuffer();

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Carrega de volta com ExcelJS para verificar integridade da planilha
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.getWorksheet('Membros');
    expect(worksheet).toBeDefined();

    const headers: string[] = [];
    worksheet?.getRow(1).eachCell((cell) => {
      headers.push(String(cell.value));
    });

    expect(headers).toEqual(MEMBER_IMPORT_COLUMNS.map((c) => c.header));
    expect(worksheet?.getRow(2).getCell(1).value).toBe(MEMBER_IMPORT_COLUMNS[0].example);
    expect(worksheet?.getRow(3).getCell(1).value).toBe(MEMBER_IMPORT_COLUMNS[0].example2);
  });
});
