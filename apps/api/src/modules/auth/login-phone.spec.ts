import { maskLoginPhone, normalizeLoginPhone } from './login-phone';

describe('login phone helpers', () => {
  describe('normalizeLoginPhone', () => {
    it.each([
      ['+55 (11) 99999-9999', '+5511999999999'],
      ['+351 912 345 678', '+351912345678'],
      ['+1 (415) 555-2671', '+14155552671'],
    ])('normaliza %s para E.164', (input, expected) => {
      expect(normalizeLoginPhone(input)).toBe(expected);
    });

    it.each(['11999999999', '+55', '', 'telefone'])('rejeita %s', (input) => {
      expect(normalizeLoginPhone(input)).toBeNull();
    });
  });

  describe('maskLoginPhone', () => {
    it('exibe somente os quatro ultimos digitos', () => {
      expect(maskLoginPhone('+5511999999999')).toBe('***9999');
    });

    it('preserva ausencia de telefone', () => {
      expect(maskLoginPhone(null)).toBeNull();
    });
  });
});
