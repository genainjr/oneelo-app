import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';

@Injectable()
export class FinancialAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAuthorization: FinanceAuthorizationService,
  ) {}

  async findAll(tenantId: string, actor: JwtPayload) {
    await this.financeAuthorization.ensureCanAccessFinanceData(tenantId, actor);

    const accounts = await this.prisma.financialAccount.findMany({
      where: { tenantId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return accounts.map((account) => ({
      ...account,
      initialBalance: account.initialBalance.toNumber(),
    }));
  }

  async create(tenantId: string, actor: JwtPayload, dto: CreateFinancialAccountDto) {
    await this.financeAuthorization.ensureFinanceManager(tenantId, actor);
    await this.ensureNameAvailable(tenantId, dto.name);

    const account = await this.prisma.financialAccount.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        type: dto.type,
        initialBalance: dto.initialBalance ?? 0,
        active: dto.active ?? true,
      },
    });

    return { ...account, initialBalance: account.initialBalance.toNumber() };
  }

  async update(
    tenantId: string,
    actor: JwtPayload,
    id: string,
    dto: UpdateFinancialAccountDto,
  ) {
    await this.financeAuthorization.ensureFinanceManager(tenantId, actor);
    await this.findOneOrThrow(tenantId, id);

    if (dto.name) {
      await this.ensureNameAvailable(tenantId, dto.name, id);
    }

    const account = await this.prisma.financialAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.initialBalance !== undefined ? { initialBalance: dto.initialBalance } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    return { ...account, initialBalance: account.initialBalance.toNumber() };
  }

  async deactivate(tenantId: string, actor: JwtPayload, id: string) {
    return this.update(tenantId, actor, id, { active: false });
  }

  private async findOneOrThrow(tenantId: string, id: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundException('Conta financeira não encontrada.');
    }

    return account;
  }

  private async ensureNameAvailable(tenantId: string, name: string, ignoreId?: string) {
    const conflict = await this.prisma.financialAccount.findFirst({
      where: {
        tenantId,
        name: name.trim(),
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException('Já existe uma conta financeira com este nome.');
    }
  }
}
