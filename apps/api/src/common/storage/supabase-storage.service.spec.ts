import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseStorageService } from './supabase-storage.service';

describe('SupabaseStorageService (private objects)', () => {
  const originalFetch = global.fetch;

  const createService = () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://demo.supabase.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
        return undefined;
      }),
    };
    return new SupabaseStorageService(config as unknown as ConfigService);
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uploadPrivateObject retorna apenas o path privado e cria bucket com public=false se ausente', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '{"error":"Bucket not found"}',
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = createService();
    const path = 'tenants/t1/financeiro/transactions/tx1/receipt.pdf';
    const result = await service.uploadPrivateObject(
      'financial-receipts',
      path,
      Buffer.from('%PDF-1.7'),
      'application/pdf',
    );

    expect(result).toBe(path);
    expect(result).not.toContain('http');
    const createBucketCall = fetchMock.mock.calls[1];
    expect(createBucketCall[0]).toBe('https://demo.supabase.co/storage/v1/bucket');
    expect(JSON.parse(createBucketCall[1].body)).toEqual(
      expect.objectContaining({ id: 'financial-receipts', public: false }),
    );
  });

  it('createPrivateSignedUrl retorna URL assinada quando sucesso e lança ServiceUnavailableException sem fallback para URL pública quando falha', async () => {
    const service = createService();

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ signedURL: '/object/sign/financial-receipts/p?token=abc' }),
    }) as unknown as typeof fetch;

    const url = await service.createPrivateSignedUrl('financial-receipts', 'p', 300);
    expect(url).toBe('https://demo.supabase.co/storage/v1/object/sign/financial-receipts/p?token=abc');

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    await expect(
      service.createPrivateSignedUrl('financial-receipts', 'p', 300),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    global.fetch = jest.fn().mockRejectedValueOnce(new Error('network down')) as unknown as typeof fetch;

    await expect(
      service.createPrivateSignedUrl('financial-receipts', 'p', 300),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('deleteObject ignora 404 quando ignoreNotFound=true', async () => {
    const service = createService();
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    }) as unknown as typeof fetch;

    await expect(
      service.deleteObject('financial-receipts', 'missing.pdf', { ignoreNotFound: true }),
    ).resolves.toBeUndefined();
  });
});
