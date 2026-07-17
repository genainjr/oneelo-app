import { includesNormalizedText, normalizeSearchText } from './search-text';

describe('search text helpers', () => {
  it('normaliza caixa, acentos e espacos externos', () => {
    expect(normalizeSearchText('  Joao Acao  ')).toBe('joao acao');
    expect(
      normalizeSearchText(
        '  Joao Acao  '.replace('Joao', 'JOAO').replace('Acao', 'ACAO'),
      ),
    ).toBe('joao acao');
    expect(normalizeSearchText('  Jo\u00e3o A\u00e7\u00e3o  ')).toBe(
      'joao acao',
    );
  });

  it('encontra texto sem distinguir caixa ou acentos', () => {
    expect(
      includesNormalizedText('Minist\u00e9rio de Louvor', 'ministerio'),
    ).toBe(true);
    expect(includesNormalizedText('JO\u00c3O DA SILVA', 'joao')).toBe(true);
    expect(includesNormalizedText('Maria', 'joao')).toBe(false);
  });
});
