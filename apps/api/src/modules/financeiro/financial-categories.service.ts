import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { UpdateFinancialCategoryDto } from './dto/update-financial-category.dto';

@Injectable()
export class FinancialCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAuthorization: FinanceAuthorizationService,
  ) {}

  async findAll(tenantId: string, actor: JwtPayload) {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);

    return this.prisma.financialCategory.findMany({
      where: { tenantId },
      orderBy: [{ active: 'desc' }, { type: 'asc' }, { name: 'asc' }],
    });
  }

  async create(tenantId: string, actor: JwtPayload, dto: CreateFinancialCategoryDto) {
    await this.financeAuthorization.ensureFinanceManager(tenantId, actor);
    await this.ensureNameAvailable(tenantId, dto.type, dto.name);

    return this.prisma.financialCategory.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        type: dto.type,
        active: dto.active ?? true,
      },
    });
  }

  async update(
    tenantId: string,
    actor: JwtPayload,
    id: string,
    dto: UpdateFinancialCategoryDto,
  ) {
    await this.financeAuthorization.ensureFinanceManager(tenantId, actor);
    const current = await this.findOneOrThrow(tenantId, id);
    const nextType = dto.type ?? current.type;
    const nextName = dto.name ?? current.name;

    if (dto.name !== undefined || dto.type !== undefined) {
      await this.ensureNameAvailable(tenantId, nextType, nextName, id);
    }

    return this.prisma.financialCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async deactivate(tenantId: string, actor: JwtPayload, id: string) {
    return this.update(tenantId, actor, id, { active: false });
  }

  private async findOneOrThrow(tenantId: string, id: string) {
    const category = await this.prisma.financialCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException('Categoria financeira não encontrada.');
    }

    return category;
  }

  private async ensureNameAvailable(
    tenantId: string,
    type: CreateFinancialCategoryDto['type'],
    name: string,
    ignoreId?: string,
  ) {
    const conflict = await this.prisma.financialCategory.findFirst({
      where: {
        tenantId,
        type,
        name: name.trim(),
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException('Já existe uma categoria financeira com este nome e tipo.');
    }
  }
}
