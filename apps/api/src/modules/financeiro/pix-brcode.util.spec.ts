import { BadRequestException } from '@nestjs/common';
import { PixKeyType } from '@prisma/client';
import {
  crc16CcittFalse,
  formatPixKeyForDisplay,
  generatePixBrCode,
  isValidCnpj,
  isValidCpf,
  normalizeAndValidatePixKey,
  normalizePixMerchantCity,
  normalizePixMerchantName,
  normalizePixTxid,
} from './pix-brcode.util';

describe('pix-brcode.util', () => {
  it('calcula CRC-16/CCITT-FALSE corretamente para vetor padrão "123456789"', () => {
    expect(crc16CcittFalse('123456789')).toBe('29B1');
  });

  it('valida e normaliza CPF e CNPJ com dígitos verificadores', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('52998224726')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(normalizeAndValidatePixKey(PixKeyType.CPF, '529.982.247-25')).toBe('52998224725');
    expect(() => normalizeAndValidatePixKey(PixKeyType.CPF, '123.456.789-00')).toThrow(
      BadRequestException,
    );

    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(normalizeAndValidatePixKey(PixKeyType.CNPJ, '11.222.333/0001-81')).toBe(
      '11222333000181',
    );
    expect(() => normalizeAndValidatePixKey(PixKeyType.CNPJ, '11.222.333/0001-00')).toThrow(
      BadRequestException,
    );
  });

  it('normaliza PHONE para +55E164, EMAIL para lowercase e valida EVP UUID', () => {
    expect(normalizeAndValidatePixKey(PixKeyType.PHONE, '(11) 98765-4321')).toBe(
      '+5511987654321',
    );
    expect(normalizeAndValidatePixKey(PixKeyType.PHONE, '+55 21 99999-8888')).toBe(
      '+5521999998888',
    );
    expect(() => normalizeAndValidatePixKey(PixKeyType.PHONE, '1133334444')).toThrow(
      BadRequestException,
    );

    expect(normalizeAndValidatePixKey(PixKeyType.EMAIL, '  Tesouraria@Igreja.ORG.br  ')).toBe(
      'tesouraria@igreja.org.br',
    );
    expect(() => normalizeAndValidatePixKey(PixKeyType.EMAIL, 'nao-eh-email')).toThrow(
      BadRequestException,
    );

    const uuid = 'A1B2C3D4-E5F6-4789-ABCD-0123456789AB';
    expect(normalizeAndValidatePixKey(PixKeyType.EVP, uuid)).toBe(uuid.toLowerCase());
    expect(() => normalizeAndValidatePixKey(PixKeyType.EVP, 'chave-invalida')).toThrow(
      BadRequestException,
    );
  });

  it('sanitiza acentos e respeita limites EMVCo de merchantName, merchantCity e txid', () => {
    expect(normalizePixMerchantName('Igreja Ação & Comunhão da Graça')).toBe(
      'Igreja Acao Comunhao da G',
    );
    expect(normalizePixMerchantCity('São José dos Campos')).toBe('Sao Jose dos Ca');
    expect(normalizePixTxid(undefined)).toBe('***');
    expect(normalizePixTxid('')).toBe('***');
    expect(normalizePixTxid('IGREJA01')).toBe('IGREJA01');
    expect(() => normalizePixTxid('IGREJA-01')).toThrow(BadRequestException);
    expect(() => normalizePixTxid('A'.repeat(26))).toThrow(BadRequestException);
  });

  it('gera BRCode EMVCo válido sem valor (txid ***) e com valor (campo 54 + CRC válido)', () => {
    const withoutAmount = generatePixBrCode({
      pixKeyType: PixKeyType.CNPJ,
      pixKey: '11.222.333/0001-81',
      merchantName: 'Igreja Batista Central',
      merchantCity: 'São Paulo',
    });

    expect(withoutAmount).toContain('000201');
    expect(withoutAmount).toContain('0014br.gov.bcb.pix011411222333000181');
    expect(withoutAmount).toContain('5204000053039865802BR');
    expect(withoutAmount).not.toContain('540');
    expect(withoutAmount).toContain('5922Igreja Batista Central');
    expect(withoutAmount).toContain('6009Sao Paulo');
    expect(withoutAmount).toContain('62070503***');
    const body1 = withoutAmount.slice(0, -4);
    expect(withoutAmount.slice(-4)).toBe(crc16CcittFalse(body1));

    const withAmount = generatePixBrCode({
      pixKeyType: PixKeyType.EMAIL,
      pixKey: 'pix@igreja.org',
      merchantName: 'Igreja Central',
      merchantCity: 'Curitiba',
      txidPrefix: 'DIZIMO2026',
      amount: 125.5,
    });

    expect(withAmount).toContain('5406125.50');
    expect(withAmount).toContain('62140510DIZIMO2026');
    const body2 = withAmount.slice(0, -4);
    expect(withAmount.slice(-4)).toBe(crc16CcittFalse(body2));
  });

  it('rejeita valor fora da faixa permitida e formata chaves para exibição', () => {
    expect(() =>
      generatePixBrCode({
        pixKeyType: PixKeyType.EMAIL,
        pixKey: 'pix@igreja.org',
        merchantName: 'Igreja',
        merchantCity: 'Recife',
        amount: 0,
      }),
    ).toThrow(BadRequestException);

    expect(formatPixKeyForDisplay(PixKeyType.CPF, '52998224725')).toBe('529.982.247-25');
    expect(formatPixKeyForDisplay(PixKeyType.CNPJ, '11222333000181')).toBe('11.222.333/0001-81');
    expect(formatPixKeyForDisplay(PixKeyType.PHONE, '+5511987654321')).toBe('+55 (11) 98765-4321');
  });
});
