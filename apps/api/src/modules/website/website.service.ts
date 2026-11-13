import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoAuditoria, DnsStatus, ModalidadeCulto, Plano, Prisma } from '@prisma/client';
import type { Multer } from 'multer';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import {
  getWebsiteBannerPath,
  getWebsiteNewsImagePath,
  getWebsitePastorsPhotoPath,
  validateImageUpload,
} from '../../common/storage/image-upload';
import {
  isReservedSlug,
  normalizeSlug,
} from '../../common/constants/reserved-slugs';
import { canUseCustomDomain } from '../../common/utils/tenant-plan';
import { UpdateWebsiteConfigDto } from './dto/update-website-config.dto';
import { CreateChurchScheduleDto } from './dto/create-church-schedule.dto';
import { UpdateChurchScheduleDto } from './dto/update-church-schedule.dto';
import { ReorderSchedulesDto } from './dto/reorder-schedules.dto';
import { CreateTenantNewsDto } from './dto/create-tenant-news.dto';
import { UpdateTenantNewsDto } from './dto/update-tenant-news.dto';
import { hasRawHtmlTags, isSafeHttpUrl } from './dto/website-validation';
import {
  normalizeAndValidateCustomDomain,
  VercelDomainsService,
} from './vercel-domains.service';

const WEBSITE_MEDIA_BUCKET = 'tenant-logos';

const PUBLIC_TENANT_SELECT = {
  id: true,
  nome: true,
  slug: true,
  logoUrl: true,
  pwaIconUrl: true,
  email: true,
  telefone: true,
  ativo: true,
} as const;

const URL_FIELDS = [
  'googleMapsUrl',
  'instagramUrl',
  'youtubeUrl',
  'facebookUrl',
  'spotifyUrl',
] as const;

const NO_HTML_CONFIG_FIELDS = [
  'sobreNos',
  'historia',
  'visaoValores',
  'pastoresBio',
] as const;

type ConfigMediaSlot = 'banner' | 'pastors';

@Injectable()
export class WebsiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
    private readonly vercelDomains: VercelDomainsService,
  ) {}

  async getPublicSiteData(slug: string) {
    const tenant = await this.findActiveTenantBySlug(slug);

    const [config, schedules, news] = await Promise.all([
      this.prisma.tenantWebsiteConfig.findUnique({
        where: { tenantId: tenant.id },
      }),
      this.prisma.churchSchedule.findMany({
        where: { tenantId: tenant.id, ativo: true },
        orderBy: [{ ordem: 'asc' }, { diaSemana: 'asc' }, { horario: 'asc' }],
      }),
      this.prisma.tenantNews.findMany({
        where: { tenantId: tenant.id, ativo: true },
        orderBy: [
          { destaque: 'desc' },
          { dataPublicacao: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 12,
      }),
    ]);

    return {
      tenant: {
        nome: tenant.nome,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        pwaIconUrl: tenant.pwaIconUrl,
        email: tenant.email,
        telefone: tenant.telefone,
      },
      config: config ? this.serializePublicConfig(config) : null,
      schedules,
      news,
    };
  }

  async getPublicNewsBySlug(slug: string, noticiaSlug: string) {
    const tenant = await this.findActiveTenantBySlug(slug);
    const cleanNewsSlug = noticiaSlug?.trim().toLowerCase();

    if (!cleanNewsSlug) {
      throw new NotFoundException('Informativo não encontrado.');
    }

    const newsItem = await this.prisma.tenantNews.findFirst({
      where: {
        tenantId: tenant.id,
        slug: cleanNewsSlug,
        ativo: true,
      },
    });

    if (!newsItem) {
      throw new NotFoundException('Informativo não encontrado.');
    }

    return {
      tenant: {
        nome: tenant.nome,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        pwaIconUrl: tenant.pwaIconUrl,
      },
      news: newsItem,
    };
  }

  async getConfig(tenantId: string) {
    const [tenant, config] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          ...PUBLIC_TENANT_SELECT,
          plano: true,
        },
      }),
      this.prisma.tenantWebsiteConfig.findUnique({
        where: { tenantId },
      }),
    ]);

    if (!tenant) {
      throw new NotFoundException('Igreja não encontrada.');
    }

    const plano = tenant.plano ?? Plano.GRATUITO;

    return {
      tenant: {
        id: tenant.id,
        nome: tenant.nome,
        slug: tenant.slug,
        plano,
        logoUrl: tenant.logoUrl,
        pwaIconUrl: tenant.pwaIconUrl,
        email: tenant.email,
        telefone: tenant.telefone,
      },
      canUseCustomDomain: canUseCustomDomain(plano),
      dnsTargets: this.vercelDomains.getDnsTargets(),
      config,
    };
  }

  async resolvePublicDomain(rawDomain: string): Promise<{ slug: string }> {
    const domain = rawDomain
      ?.trim()
      .toLowerCase()
      .replace(/:\d+$/, '')
      .replace(/\.+$/, '');

    if (!domain) {
      throw new NotFoundException('Domínio não encontrado.');
    }

    const config = await this.prisma.tenantWebsiteConfig.findFirst({
      where: {
        customDomain: domain,
        dnsStatus: DnsStatus.ACTIVE,
        tenant: { ativo: true },
      },
      select: {
        tenant: {
          select: { slug: true },
        },
      },
    });

    if (!config?.tenant?.slug) {
      throw new NotFoundException('Domínio customizado não encontrado ou inativo.');
    }

    return { slug: config.tenant.slug };
  }

  async setCustomDomain(
    tenantId: string,
    rawDomain: string,
    actorId: string,
    ip?: string | null,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plano: true },
    });

    if (!tenant) {
      throw new NotFoundException('Igreja não encontrada.');
    }

    if (!canUseCustomDomain(tenant.plano)) {
      throw new ForbiddenException(
        'Domínio próprio está disponível exclusivamente no plano Profissional.',
      );
    }

    const domain = normalizeAndValidateCustomDomain(rawDomain);

    const conflict = await this.prisma.tenantWebsiteConfig.findFirst({
      where: {
        customDomain: domain,
        NOT: { tenantId },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException(
        'Este domínio já está vinculado a outra igreja no One Elo.',
      );
    }

    const existing = await this.prisma.tenantWebsiteConfig.findUnique({
      where: { tenantId },
    });

    if (
      existing?.customDomain === domain &&
      existing.dnsStatus === DnsStatus.ACTIVE
    ) {
      return {
        customDomain: existing.customDomain,
        dnsStatus: existing.dnsStatus,
        verified: true,
        verificationChallenges: [],
        dnsTargets: this.vercelDomains.getDnsTargets(),
        dnsCheckedAt: existing.dnsCheckedAt,
        customDomainVerifiedAt: existing.customDomainVerifiedAt,
      };
    }

    if (existing?.customDomain && existing.customDomain !== domain) {
      await this.vercelDomains.removeDomain(existing.customDomain);
    }

    const registration = await this.vercelDomains.registerDomain(domain);
    const now = new Date();
    const nextStatus = registration.verified
      ? DnsStatus.ACTIVE
      : DnsStatus.PENDING;

    const updated = await this.prisma.tenantWebsiteConfig.upsert({
      where: { tenantId },
      update: {
        customDomain: domain,
        dnsStatus: nextStatus,
        dnsCheckedAt: now,
        customDomainVerifiedAt: registration.verified ? now : null,
      },
      create: {
        tenantId,
        customDomain: domain,
        dnsStatus: nextStatus,
        dnsCheckedAt: now,
        customDomainVerifiedAt: registration.verified ? now : null,
      },
    });

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantWebsiteConfig',
      updated.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      {
        customDomain: domain,
        dnsStatus: nextStatus,
      },
    );

    return {
      customDomain: updated.customDomain,
      dnsStatus: updated.dnsStatus,
      verified: registration.verified,
      verificationChallenges: registration.verificationChallenges,
      dnsTargets: this.vercelDomains.getDnsTargets(),
      dnsCheckedAt: updated.dnsCheckedAt,
      customDomainVerifiedAt: updated.customDomainVerifiedAt,
    };
  }

  async verifyCustomDomain(
    tenantId: string,
    actorId: string,
    ip?: string | null,
  ) {
    const [tenant, existing] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, plano: true },
      }),
      this.prisma.tenantWebsiteConfig.findUnique({
        where: { tenantId },
      }),
    ]);

    if (!tenant) {
      throw new NotFoundException('Igreja não encontrada.');
    }

    if (!canUseCustomDomain(tenant.plano)) {
      throw new ForbiddenException(
        'Domínio próprio está disponível exclusivamente no plano Profissional.',
      );
    }

    if (!existing?.customDomain) {
      throw new BadRequestException(
        'Nenhum domínio personalizado configurado para verificação.',
      );
    }

    const outcome = await this.vercelDomains.verifyDomain(existing.customDomain);
    const now = new Date();
    const verifiedAt =
      outcome.dnsStatus === DnsStatus.ACTIVE
        ? (existing.customDomainVerifiedAt ?? now)
        : null;

    const updated = await this.prisma.tenantWebsiteConfig.update({
      where: { id: existing.id },
      data: {
        dnsStatus: outcome.dnsStatus,
        dnsCheckedAt: now,
        customDomainVerifiedAt: verifiedAt,
      },
    });

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantWebsiteConfig',
      updated.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      {
        customDomain: existing.customDomain,
        dnsStatus: outcome.dnsStatus,
      },
    );

    return {
      customDomain: updated.customDomain,
      ...outcome,
      dnsTargets: this.vercelDomains.getDnsTargets(),
      dnsCheckedAt: updated.dnsCheckedAt,
      customDomainVerifiedAt: updated.customDomainVerifiedAt,
    };
  }

  async removeCustomDomain(
    tenantId: string,
    actorId: string,
    ip?: string | null,
  ) {
    const existing = await this.prisma.tenantWebsiteConfig.findUnique({
      where: { tenantId },
    });

    if (!existing?.customDomain) {
      return {
        customDomain: null,
        dnsStatus: DnsStatus.PENDING,
        removed: false,
      };
    }

    const removedDomain = existing.customDomain;
    await this.vercelDomains.removeDomain(removedDomain);

    await this.prisma.tenantWebsiteConfig.update({
      where: { id: existing.id },
      data: {
        customDomain: null,
        dnsStatus: DnsStatus.PENDING,
        dnsCheckedAt: null,
        customDomainVerifiedAt: null,
      },
    });

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantWebsiteConfig',
      existing.id,
      AcaoAuditoria.DELETAR,
      ip,
      {
        removedCustomDomain: removedDomain,
      },
    );

    return {
      customDomain: null,
      dnsStatus: DnsStatus.PENDING,
      removed: true,
    };
  }

  async updateConfig(
    tenantId: string,
    dto: UpdateWebsiteConfigDto,
    actorId: string,
    ip?: string | null,
  ) {
    this.validateConfigFields(dto);

    const data: Prisma.TenantWebsiteConfigUncheckedUpdateInput = {
      ...(dto.tituloHero !== undefined && { tituloHero: dto.tituloHero }),
      ...(dto.subtituloHero !== undefined && {
        subtituloHero: dto.subtituloHero,
      }),
      ...(dto.versiculoTema !== undefined && {
        versiculoTema: dto.versiculoTema,
      }),
      ...(dto.versiculoReferencia !== undefined && {
        versiculoReferencia: dto.versiculoReferencia,
      }),
      ...(dto.sobreNos !== undefined && { sobreNos: dto.sobreNos }),
      ...(dto.historia !== undefined && { historia: dto.historia }),
      ...(dto.visaoValores !== undefined && { visaoValores: dto.visaoValores }),
      ...(dto.pastoresNomes !== undefined && {
        pastoresNomes: dto.pastoresNomes,
      }),
      ...(dto.pastoresBio !== undefined && { pastoresBio: dto.pastoresBio }),
      ...(dto.endereco !== undefined && { endereco: dto.endereco }),
      ...(dto.numero !== undefined && { numero: dto.numero }),
      ...(dto.bairro !== undefined && { bairro: dto.bairro }),
      ...(dto.cidade !== undefined && { cidade: dto.cidade }),
      ...(dto.estado !== undefined && { estado: dto.estado }),
      ...(dto.cep !== undefined && { cep: dto.cep }),
      ...(dto.googleMapsUrl !== undefined && {
        googleMapsUrl: dto.googleMapsUrl,
      }),
      ...(dto.horarioSecretaria !== undefined && {
        horarioSecretaria: dto.horarioSecretaria,
      }),
      ...(dto.instagramUrl !== undefined && { instagramUrl: dto.instagramUrl }),
      ...(dto.youtubeUrl !== undefined && { youtubeUrl: dto.youtubeUrl }),
      ...(dto.facebookUrl !== undefined && { facebookUrl: dto.facebookUrl }),
      ...(dto.spotifyUrl !== undefined && { spotifyUrl: dto.spotifyUrl }),
      ...(dto.whatsappAtendimento !== undefined && {
        whatsappAtendimento: dto.whatsappAtendimento,
      }),
    };

    const config = await this.prisma.tenantWebsiteConfig.upsert({
      where: { tenantId },
      update: data,
      create: {
        tenantId,
        ...(data as Omit<
          Prisma.TenantWebsiteConfigUncheckedCreateInput,
          'tenantId'
        >),
      },
    });

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantWebsiteConfig',
      config.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      data,
    );

    return config;
  }

  async uploadConfigMedia(
    tenantId: string,
    slot: ConfigMediaSlot,
    file: Multer.File | undefined,
    actorId: string,
    ip?: string | null,
  ) {
    const label = slot === 'banner' ? 'banner do site' : 'foto dos pastores';
    validateImageUpload(file, label);

    const existing = await this.prisma.tenantWebsiteConfig.findUnique({
      where: { tenantId },
      select: { id: true, bannerKey: true, pastoresFotoKey: true },
    });

    const path =
      slot === 'banner'
        ? getWebsiteBannerPath(tenantId, file!)
        : getWebsitePastorsPhotoPath(tenantId, file!);

    const publicUrl = await this.storageService.uploadPublicObject(
      WEBSITE_MEDIA_BUCKET,
      path,
      file!.buffer,
      file!.mimetype,
    );

    const previousKey =
      slot === 'banner' ? existing?.bannerKey : existing?.pastoresFotoKey;

    const mediaData =
      slot === 'banner'
        ? { bannerUrl: publicUrl, bannerKey: path }
        : { pastoresFotoUrl: publicUrl, pastoresFotoKey: path };

    const updated = await this.prisma.tenantWebsiteConfig.upsert({
      where: { tenantId },
      update: mediaData,
      create: { tenantId, ...mediaData },
    });

    if (previousKey && previousKey !== path) {
      await this.storageService
        .deleteObject(WEBSITE_MEDIA_BUCKET, previousKey)
        .catch(() => undefined);
    }

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantWebsiteConfig',
      updated.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      mediaData,
    );

    return updated;
  }

  async removeConfigMedia(
    tenantId: string,
    slot: ConfigMediaSlot,
    actorId: string,
    ip?: string | null,
  ) {
    const existing = await this.prisma.tenantWebsiteConfig.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Configuração do site não encontrada.');
    }

    const previousKey =
      slot === 'banner' ? existing.bannerKey : existing.pastoresFotoKey;

    const mediaData =
      slot === 'banner'
        ? { bannerUrl: null, bannerKey: null }
        : { pastoresFotoUrl: null, pastoresFotoKey: null };

    const updated = await this.prisma.tenantWebsiteConfig.update({
      where: { tenantId },
      data: mediaData,
    });

    if (previousKey) {
      await this.storageService
        .deleteObject(WEBSITE_MEDIA_BUCKET, previousKey)
        .catch(() => undefined);
    }

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantWebsiteConfig',
      updated.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      { removedSlot: slot },
    );

    return updated;
  }

  async listSchedules(tenantId: string) {
    return this.prisma.churchSchedule.findMany({
      where: { tenantId },
      orderBy: [{ ordem: 'asc' }, { diaSemana: 'asc' }, { horario: 'asc' }],
    });
  }

  async createSchedule(
    tenantId: string,
    dto: CreateChurchScheduleDto,
    actorId: string,
    ip?: string | null,
  ) {
    let ordem = dto.ordem;
    if (ordem === undefined) {
      const last = await this.prisma.churchSchedule.findFirst({
        where: { tenantId },
        orderBy: { ordem: 'desc' },
        select: { ordem: true },
      });
      ordem = (last?.ordem ?? -1) + 1;
    }

    const schedule = await this.prisma.churchSchedule.create({
      data: {
        tenantId,
        diaSemana: dto.diaSemana,
        horario: dto.horario.trim(),
        titulo: dto.titulo.trim(),
        descricao: dto.descricao ?? null,
        modalidade: dto.modalidade ?? ModalidadeCulto.PRESENCIAL,
        ordem,
        ativo: dto.ativo ?? true,
      },
    });

    await this.recordAudit(
      tenantId,
      actorId,
      'ChurchSchedule',
      schedule.id,
      AcaoAuditoria.CRIAR,
      ip,
      {
        titulo: schedule.titulo,
        diaSemana: schedule.diaSemana,
        horario: schedule.horario,
      },
    );

    return schedule;
  }

  async updateSchedule(
    tenantId: string,
    id: string,
    dto: UpdateChurchScheduleDto,
    actorId: string,
    ip?: string | null,
  ) {
    await this.findScheduleOrThrow(tenantId, id);

    const updated = await this.prisma.churchSchedule.update({
      where: { id },
      data: {
        ...(dto.diaSemana !== undefined && { diaSemana: dto.diaSemana }),
        ...(dto.horario !== undefined && { horario: dto.horario.trim() }),
        ...(dto.titulo !== undefined && { titulo: dto.titulo.trim() }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.modalidade !== undefined && { modalidade: dto.modalidade }),
        ...(dto.ordem !== undefined && { ordem: dto.ordem }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
      },
    });

    await this.recordAudit(
      tenantId,
      actorId,
      'ChurchSchedule',
      updated.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      dto as unknown as Prisma.InputJsonValue,
    );

    return updated;
  }

  async deleteSchedule(
    tenantId: string,
    id: string,
    actorId: string,
    ip?: string | null,
  ) {
    const existing = await this.findScheduleOrThrow(tenantId, id);

    await this.prisma.churchSchedule.delete({ where: { id } });

    await this.recordAudit(
      tenantId,
      actorId,
      'ChurchSchedule',
      id,
      AcaoAuditoria.DELETAR,
      ip,
      { titulo: existing.titulo },
    );

    return { deleted: true, id };
  }

  async reorderSchedules(
    tenantId: string,
    dto: ReorderSchedulesDto,
    actorId: string,
    ip?: string | null,
  ) {
    const uniqueIds = Array.from(new Set(dto.orderedIds));
    const existing = await this.prisma.churchSchedule.findMany({
      where: { tenantId, id: { in: uniqueIds } },
      select: { id: true },
    });

    if (existing.length !== uniqueIds.length) {
      throw new NotFoundException(
        'Um ou mais horários informados não pertencem a esta igreja.',
      );
    }

    await this.prisma.$transaction(
      uniqueIds.map((id, index) =>
        this.prisma.churchSchedule.update({
          where: { id },
          data: { ordem: index },
        }),
      ),
    );

    await this.recordAudit(
      tenantId,
      actorId,
      'ChurchSchedule',
      tenantId,
      AcaoAuditoria.ATUALIZAR,
      ip,
      { orderedIds: uniqueIds },
    );

    return this.listSchedules(tenantId);
  }

  async listNews(tenantId: string) {
    return this.prisma.tenantNews.findMany({
      where: { tenantId },
      orderBy: [
        { destaque: 'desc' },
        { dataPublicacao: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async createNews(
    tenantId: string,
    dto: CreateTenantNewsDto,
    actorId: string,
    ip?: string | null,
  ) {
    this.validateNewsFields(dto);
    const slug = await this.generateUniqueNewsSlug(tenantId, dto.titulo);

    const created = await this.prisma.tenantNews.create({
      data: {
        tenantId,
        titulo: dto.titulo.trim(),
        slug,
        resumo: dto.resumo ?? null,
        conteudo: dto.conteudo.trim(),
        dataPublicacao: dto.dataPublicacao
          ? new Date(dto.dataPublicacao)
          : new Date(),
        destaque: dto.destaque ?? false,
        ativo: dto.ativo ?? true,
      },
    });

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantNews',
      created.id,
      AcaoAuditoria.CRIAR,
      ip,
      { titulo: created.titulo, slug: created.slug },
    );

    return created;
  }

  async updateNews(
    tenantId: string,
    id: string,
    dto: UpdateTenantNewsDto,
    actorId: string,
    ip?: string | null,
  ) {
    const existing = await this.findNewsOrThrow(tenantId, id);
    this.validateNewsFields(dto);

    let nextSlug = existing.slug;
    if (dto.titulo !== undefined && dto.titulo.trim() !== existing.titulo) {
      nextSlug = await this.generateUniqueNewsSlug(tenantId, dto.titulo, id);
    }

    const updated = await this.prisma.tenantNews.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined && {
          titulo: dto.titulo.trim(),
          slug: nextSlug,
        }),
        ...(dto.resumo !== undefined && { resumo: dto.resumo }),
        ...(dto.conteudo !== undefined && { conteudo: dto.conteudo.trim() }),
        ...(dto.dataPublicacao !== undefined && {
          dataPublicacao: new Date(dto.dataPublicacao),
        }),
        ...(dto.destaque !== undefined && { destaque: dto.destaque }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
      },
    });

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantNews',
      updated.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      { titulo: updated.titulo, slug: updated.slug, ativo: updated.ativo },
    );

    return updated;
  }

  async deleteNews(
    tenantId: string,
    id: string,
    actorId: string,
    ip?: string | null,
  ) {
    const existing = await this.findNewsOrThrow(tenantId, id);

    await this.prisma.tenantNews.delete({ where: { id } });

    if (existing.imagemKey) {
      await this.storageService
        .deleteObject(WEBSITE_MEDIA_BUCKET, existing.imagemKey)
        .catch(() => undefined);
    }

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantNews',
      id,
      AcaoAuditoria.DELETAR,
      ip,
      { titulo: existing.titulo },
    );

    return { deleted: true, id };
  }

  async uploadNewsImage(
    tenantId: string,
    id: string,
    file: Multer.File | undefined,
    actorId: string,
    ip?: string | null,
  ) {
    validateImageUpload(file, 'imagem do informativo');
    const existing = await this.findNewsOrThrow(tenantId, id);

    const path = getWebsiteNewsImagePath(tenantId, id, file!);
    const imagemUrl = await this.storageService.uploadPublicObject(
      WEBSITE_MEDIA_BUCKET,
      path,
      file!.buffer,
      file!.mimetype,
    );

    const updated = await this.prisma.tenantNews.update({
      where: { id },
      data: {
        imagemUrl,
        imagemKey: path,
      },
    });

    if (existing.imagemKey && existing.imagemKey !== path) {
      await this.storageService
        .deleteObject(WEBSITE_MEDIA_BUCKET, existing.imagemKey)
        .catch(() => undefined);
    }

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantNews',
      updated.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      { imagemKey: path, imagemUrl },
    );

    return updated;
  }

  async removeNewsImage(
    tenantId: string,
    id: string,
    actorId: string,
    ip?: string | null,
  ) {
    const existing = await this.findNewsOrThrow(tenantId, id);

    const updated = await this.prisma.tenantNews.update({
      where: { id },
      data: {
        imagemUrl: null,
        imagemKey: null,
      },
    });

    if (existing.imagemKey) {
      await this.storageService
        .deleteObject(WEBSITE_MEDIA_BUCKET, existing.imagemKey)
        .catch(() => undefined);
    }

    await this.recordAudit(
      tenantId,
      actorId,
      'TenantNews',
      updated.id,
      AcaoAuditoria.ATUALIZAR,
      ip,
      { removedImage: true },
    );

    return updated;
  }

  private async findActiveTenantBySlug(slug: string) {
    const cleanSlug = normalizeSlug(slug || '');
    if (!cleanSlug || isReservedSlug(cleanSlug)) {
      throw new NotFoundException('Site da igreja não encontrado.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: cleanSlug },
      select: PUBLIC_TENANT_SELECT,
    });

    if (!tenant || !tenant.ativo) {
      throw new NotFoundException('Site da igreja não encontrado.');
    }

    return tenant;
  }

  private async findScheduleOrThrow(tenantId: string, id: string) {
    const schedule = await this.prisma.churchSchedule.findFirst({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException('Horário de culto não encontrado.');
    }

    return schedule;
  }

  private async findNewsOrThrow(tenantId: string, id: string) {
    const news = await this.prisma.tenantNews.findFirst({
      where: { id, tenantId },
    });

    if (!news) {
      throw new NotFoundException('Informativo não encontrado.');
    }

    return news;
  }

  private validateConfigFields(dto: UpdateWebsiteConfigDto) {
    for (const field of URL_FIELDS) {
      const value = dto[field];
      if (value && !isSafeHttpUrl(value)) {
        throw new BadRequestException(
          `A URL informada em ${field} deve começar com http:// ou https://.`,
        );
      }
    }

    for (const field of NO_HTML_CONFIG_FIELDS) {
      const value = dto[field];
      if (value && hasRawHtmlTags(value)) {
        throw new BadRequestException(
          'Os textos institucionais não podem conter tags HTML.',
        );
      }
    }
  }

  private validateNewsFields(dto: CreateTenantNewsDto | UpdateTenantNewsDto) {
    if (dto.resumo && hasRawHtmlTags(dto.resumo)) {
      throw new BadRequestException('O resumo não pode conter tags HTML.');
    }

    if (dto.conteudo && hasRawHtmlTags(dto.conteudo)) {
      throw new BadRequestException('O conteúdo não pode conter tags HTML.');
    }
  }

  private slugifyNewsTitle(titulo: string): string {
    const base = titulo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return base || 'informativo';
  }

  private async generateUniqueNewsSlug(
    tenantId: string,
    titulo: string,
    excludeId?: string,
  ): Promise<string> {
    const baseSlug = this.slugifyNewsTitle(titulo);
    const matches = await this.prisma.tenantNews.findMany({
      where: {
        tenantId,
        slug: { startsWith: baseSlug },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { slug: true },
    });

    const existingSlugs = new Set(matches.map((item) => item.slug));
    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let suffix = 2;
    while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
      suffix += 1;
    }

    return `${baseSlug}-${suffix}`;
  }

  private serializePublicConfig(config: {
    tituloHero: string | null;
    subtituloHero: string | null;
    bannerUrl: string | null;
    versiculoTema: string | null;
    versiculoReferencia: string | null;
    sobreNos: string | null;
    historia: string | null;
    visaoValores: string | null;
    pastoresNomes: string | null;
    pastoresBio: string | null;
    pastoresFotoUrl: string | null;
    endereco: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    googleMapsUrl: string | null;
    horarioSecretaria: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
    facebookUrl: string | null;
    spotifyUrl: string | null;
    whatsappAtendimento: string | null;
  }) {
    return {
      tituloHero: config.tituloHero,
      subtituloHero: config.subtituloHero,
      bannerUrl: config.bannerUrl,
      versiculoTema: config.versiculoTema,
      versiculoReferencia: config.versiculoReferencia,
      sobreNos: config.sobreNos,
      historia: config.historia,
      visaoValores: config.visaoValores,
      pastoresNomes: config.pastoresNomes,
      pastoresBio: config.pastoresBio,
      pastoresFotoUrl: config.pastoresFotoUrl,
      endereco: config.endereco,
      numero: config.numero,
      bairro: config.bairro,
      cidade: config.cidade,
      estado: config.estado,
      cep: config.cep,
      googleMapsUrl: config.googleMapsUrl,
      horarioSecretaria: config.horarioSecretaria,
      instagramUrl: config.instagramUrl,
      youtubeUrl: config.youtubeUrl,
      facebookUrl: config.facebookUrl,
      spotifyUrl: config.spotifyUrl,
      whatsappAtendimento: config.whatsappAtendimento,
    };
  }

  private async recordAudit(
    tenantId: string,
    userId: string,
    entidade: string,
    entidadeId: string,
    acao: AcaoAuditoria,
    ipAddress?: string | null,
    payloadAfter?: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        entidade,
        entidadeId,
        acao,
        ipAddress: ipAddress ?? null,
        payloadAfter,
      },
    });
  }
}
