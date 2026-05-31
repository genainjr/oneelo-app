# Camada de Serviços (Services) no NestJS

Os **Services** (`*.service.ts`) concentram as regras de negócio da API, validações de limites de quotas operacionais e orquestração de chamadas ao banco de dados PostgreSQL.

---

## Princípios de Desenvolvimento

1. **Responsabilidade Única**: O Controller deve apenas receber a requisição e validar o DTO; a tomada de decisão lógica e as transações de dados devem estar exclusivamente no Service.
2. **Isolamento de Tenant**: Todo método que lê ou escreve dados deve exigir `tenantId: string` de maneira explícita como parâmetro.
3. **Erros Semânticos**: Services não devem retornar códigos de erro HTTP puros ou lidar com formatação de responses HTTP. Devem lançar exceções semânticas nativas do NestJS (ex: `NotFoundException`, `ForbiddenException`).

---

## Acesso ao Banco de Dados com Prisma

### Uso do PrismaService Estendido
Para garantir que as regras automáticas (como o filtro implícito de Soft Delete para `Membro`) sejam respeitadas, o Service deve usar a propriedade estendida do cliente:

```typescript
// ❌ INAPROPRIADO (ignora as extensões globais de Soft Delete)
await this.prisma.membro.findMany({ where: { tenantId } });

// ✅ RECOMENDADO (utiliza o cliente estendido do PrismaService)
await this.prisma.client.membro.findMany({ where: { tenantId } });
```

---

## Fluxo de Tenant Isolation nos Métodos

Nunca se deve obter o `tenantId` a partir de objetos mutáveis vindos do cliente frontend (como no body de um POST ou PATCH). O `tenantId` resolvido pela sessão autenticada deve ser passado do Controller ao Service:

```typescript
// Exemplo no Controller (membros.controller.ts)
@Post()
create(@Request() req, @Body() dto: CreateMembroDto) {
  const tenantId = req.tenantId; // Resolvido pelo JwtAuthGuard
  return this.membrosService.create(tenantId, dto);
}

// Exemplo no Service (membros.service.ts)
async create(tenantId: string, dto: CreateMembroDto) {
  // Executa regras operando estritamente dentro do escopo do tenantId fornecido
  ...
}
```

---

## Padrão de Validações em Escrita (Exemplo Membro)

Ao criar ou atualizar recursos, os Services devem validar permissões e limites sequencialmente:

1. **Validação de Quota**: Verifica se a criação viola limites de planos cadastrados no model `Tenant`.
2. **Validação de Dependências**: Garante que IDs de relacionamentos (ex: `tagsIds` em lote) pertencem ao mesmo `tenantId`.
3. **Escrita no Banco**: Utiliza transações Prisma (`this.prisma.$transaction`) ao manipular tabelas associativas N:N (como `MembroTag` ou `MinisterioMembro`) para evitar estados órfãos em caso de falha.

---

## Exemplo Prático de Código de Serviço

Abaixo está o esqueleto padrão recomendado para implementação de serviços complexos no repositório:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMembroDto } from './dto/create-membro.dto';

@Injectable()
export class MembrosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateMembroDto) {
    // 1. Validar existência do tenant e limite de planos
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }

    const totalAtivos = await this.prisma.client.membro.count({
      where: { tenantId },
    });

    if (totalAtivos >= tenant.limiteMembros) {
      throw new ForbiddenException(
        `Limite de membros (${tenant.limiteMembros}) atingido para o plano ${tenant.plano}.`
      );
    }

    // 2. Criação do registro utilizando o Prisma Client estendido
    return this.prisma.client.membro.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    // Garante isolamento de tenant na busca individual
    const membro = await this.prisma.client.membro.findFirst({
      where: { id, tenantId },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado neste Tenant.');
    }

    return membro;
  }
}
```
