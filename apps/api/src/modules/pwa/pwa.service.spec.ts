import { PwaService } from './pwa.service';

describe('PwaService', () => {
  const findFirst = jest.fn();
  const service = new PwaService({ tenant: { findFirst } } as any);

  beforeEach(() => findFirst.mockReset());

  it('retorna fallback OneElo quando a configuracao esta incompleta', async () => {
    findFirst.mockResolvedValue({ id: 'tenant-1', nome: 'Igreja', pwaShortName: 'Igreja' });
    const result = await service.getManifest('igreja');
    expect(result.version).toBe('oneelo');
    expect(result.manifest).toMatchObject({ name: 'One Elo', short_name: 'One Elo' });
  });

  it('retorna manifesto personalizado com id estavel do tenant', async () => {
    findFirst.mockResolvedValue({
      id: 'tenant-1',
      nome: 'Comunidade da Graca',
      pwaShortName: 'Comunidade',
      pwaIconUrl: 'https://storage.test/tenants/tenant-1/pwa/v1/icon-512.png',
      pwaIconKey: 'tenants/tenant-1/pwa/v1/icon-512.png',
      pwaUpdatedAt: new Date('2026-07-18T12:00:00Z'),
    });

    const result = await service.getManifest('comunidade');
    expect(result.manifest).toMatchObject({
      name: 'Comunidade',
      short_name: 'Comunidade',
      id: '/pwa/tenant/tenant-1',
      start_url: '/dashboard?source=pwa',
    });
    expect(result.version).toBe(`${new Date('2026-07-18T12:00:00Z').getTime()}-3`);
    expect(result.manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: expect.stringContaining('icon-192.png?v='), purpose: 'any' }),
      expect.objectContaining({ src: expect.stringContaining('icon-512.png?v='), purpose: 'any' }),
      expect.objectContaining({ src: expect.stringContaining('icon-maskable-512.png'), purpose: 'maskable' }),
    ]));
  });

  it('consulta somente tenant ativo pelo slug', async () => {
    findFirst.mockResolvedValue(null);
    await service.getManifest('igreja');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'igreja', ativo: true } }));
  });
});
