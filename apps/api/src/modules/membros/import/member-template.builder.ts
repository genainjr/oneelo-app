import ExcelJS from 'exceljs';

export interface ColumnDefinition {
  header: string;
  key: string;
  width: number;
  example: string;
  example2?: string;
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
    width: 20,
    example: '15/08/1988',
    example2: '22/03/1992',
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
    width: 20,
    example: '10/12/2005',
    example2: '18/06/2015',
  },
  {
    header: 'CPF',
    key: 'cpf',
    width: 18,
    example: '123.456.789-00',
    example2: '987.654.321-00',
  },
  {
    header: 'RG',
    key: 'rg',
    width: 16,
    example: '12.345.678-9',
    example2: '',
  },
  {
    header: 'Matrícula / Rol',
    key: 'matricula',
    width: 18,
    example: 'ROL-001',
    example2: 'ROL-002',
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
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF4B5563' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
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
