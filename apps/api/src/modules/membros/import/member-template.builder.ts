import ExcelJS from 'exceljs';

export interface ColumnDefinition {
  header: string;
  key: string;
  width: number;
  example: string;
  example2?: string;
  numFmt?: string;
}

export const MEMBER_IMPORT_COLUMNS: ColumnDefinition[] = [
  {
    header: 'Nome Completo*',
    key: 'nome',
    width: 32,
    example: 'Carlos Eduardo da Silva',
    example2: 'Maria Aparecida Santos',
  },
  {
    header: 'Nome de Exibição',
    key: 'nomeExibicao',
    width: 24,
    example: 'Carlos Silva',
    example2: 'Cida Santos',
  },
  {
    header: 'WhatsApp / Celular',
    key: 'whatsapp',
    width: 22,
    example: '(11) 98765-4321',
    example2: '(11) 97654-3210',
    numFmt: '[<=9999999999]\\(00\\)\\ 0000\\-0000;\\(00\\)\\ 00000\\-0000',
  },
  {
    header: 'E-mail',
    key: 'email',
    width: 28,
    example: 'carlos.silva@email.com',
    example2: 'cida.santos@email.com',
  },
  {
    header: 'Data de Nascimento',
    key: 'dataNascimento',
    width: 22,
    example: '15/08/1988',
    example2: '22/03/1992',
    numFmt: '00\\/00\\/0000',
  },
  {
    header: 'Sexo',
    key: 'sexo',
    width: 16,
    example: 'Masculino',
    example2: 'Feminino',
  },
  {
    header: 'Estado Civil',
    key: 'estadoCivil',
    width: 18,
    example: 'Casado(a)',
    example2: 'Solteiro(a)',
  },
  {
    header: 'Cargo / Função',
    key: 'cargo',
    width: 20,
    example: 'Membro',
    example2: 'Diácono',
  },
  {
    header: 'Data de Batismo',
    key: 'dataBatismo',
    width: 22,
    example: '10/12/2005',
    example2: '18/06/2015',
    numFmt: '00\\/00\\/0000',
  },
  {
    header: 'CPF',
    key: 'cpf',
    width: 18,
    example: '123.456.789-00',
    example2: '987.654.321-00',
    numFmt: '000\\.000\\.000\\-00',
  },
  {
    header: 'RG',
    key: 'rg',
    width: 24,
    example: '12.345.678-9',
    example2: '',
    numFmt: '@',
  },
  {
    header: 'Matrícula / Rol',
    key: 'matricula',
    width: 20,
    example: 'ROL-001',
    example2: 'ROL-002',
    numFmt: '@',
  },
  {
    header: 'Observações',
    key: 'observacoes',
    width: 34,
    example: 'Líder de recepção',
    example2: 'Membro transferido da sede',
  },
];

export async function buildMemberImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OneElo Gestão para Igrejas';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Membros', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Configura colunas
  worksheet.columns = MEMBER_IMPORT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Estiliza cabeçalho (Linha 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo-600
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF3730A3' } },
    };
  });

  // Linhas de exemplo
  const exampleRow1 = MEMBER_IMPORT_COLUMNS.map((col) => col.example);
  const exampleRow2 = MEMBER_IMPORT_COLUMNS.map((col) => col.example2 || '');

  const row2 = worksheet.addRow(exampleRow1);
  const row3 = worksheet.addRow(exampleRow2);

  [row2, row3].forEach((r) => {
    r.height = 20;
    r.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  // Aplica formatação e fontes nas colunas (linhas 4 a 500 para dados digitados)
  MEMBER_IMPORT_COLUMNS.forEach((col, idx) => {
    if (col.numFmt) {
      worksheet.getColumn(col.key).numFmt = col.numFmt;
    }
    for (let i = 2; i <= 500; i++) {
      const cell = worksheet.getCell(i, idx + 1);
      if (col.numFmt) {
        cell.numFmt = col.numFmt;
      }
      if (i >= 4) {
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  });

  // Adiciona validações de dados (Listas suspensas)
  // Coluna F (Sexo) e Coluna G (Estado Civil)
  const sexoColLetter = 'F';
  const estadoCivilColLetter = 'G';

  for (let i = 2; i <= 500; i++) {
    worksheet.getCell(`${sexoColLetter}${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Masculino,Feminino"'],
      showErrorMessage: true,
      errorTitle: 'Sexo Inválido',
      error: 'Selecione Masculino ou Feminino na lista.',
    };

    worksheet.getCell(`${estadoCivilColLetter}${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Solteiro(a),Casado(a),Divorciado(a),Viúvo(a),Outro"'],
      showErrorMessage: true,
      errorTitle: 'Estado Civil Inválido',
      error: 'Selecione uma opção válida na lista suspensa.',
    };
  }

  const uint8 = await workbook.xlsx.writeBuffer();
  return Buffer.from(uint8);
}
