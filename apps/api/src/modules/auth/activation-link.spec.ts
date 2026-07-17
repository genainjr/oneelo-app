import { buildActivationLink } from './activation-link';

describe('buildActivationLink', () => {
  it('usa a origem publica do frontend configurada', () => {
    expect(buildActivationLink('token-123', 'https://app.exemplo.com/', 'production'))
      .toBe('https://app.exemplo.com/activate/token-123');
  });

  it('usa a primeira origem quando o CORS permite mais de um frontend', () => {
    expect(buildActivationLink(
      'token-123',
      'https://app.exemplo.com, https://admin.exemplo.com',
      'production',
    )).toBe('https://app.exemplo.com/activate/token-123');
  });

  it('usa o frontend vigente e nao a API como fallback em producao', () => {
    expect(buildActivationLink('token-123', undefined, 'production'))
      .toBe('https://oneelo.vercel.app/activate/token-123');
  });

  it('usa o frontend local fora de producao', () => {
    expect(buildActivationLink('token-123'))
      .toBe('http://localhost:3001/activate/token-123');
  });
});
