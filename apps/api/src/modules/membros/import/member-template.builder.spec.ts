import ExcelJS from 'exceljs';
import {
  buildMemberImportTemplateBuffer,
  MEMBER_IMPORT_COLUMNS,
} from './member-template.builder';

describe('MemberTemplateBuilder', () => {
  it('deve gerar buffer XLSX válido com cabeçalhos, formatações e validações corretas', async () => {
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

    // Verifica formatações de datas, whatsapp e CPF
    expect(worksheet?.getCell('E2').numFmt).toBe('dd/mm/yyyy');
    expect(worksheet?.getCell('I2').numFmt).toBe('dd/mm/yyyy');
    expect(worksheet?.getCell('J2').numFmt).toBe('000.000.000-00');
    expect(worksheet?.getCell('C2').numFmt).toBeDefined();
  });
});
