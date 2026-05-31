import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private _extendedClient: any;

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Retorna o cliente estendido com as regras globais do MVP,
   * como o filtro automático de Soft Delete para a entidade Membro.
   */
  get client() {
    if (!this._extendedClient) {
      this._extendedClient = this.$extends({
        query: {
          membro: {
            async findMany({ args, query }) {
              args.where = { ...args.where, deletedAt: null };
              return query(args);
            },
            async findFirst({ args, query }) {
              args.where = { ...args.where, deletedAt: null };
              return query(args);
            },
            async findUnique({ args, query }) {
              args.where = { ...args.where, deletedAt: null };
              return query(args);
            },
            async count({ args, query }) {
              args.where = { ...args.where, deletedAt: null };
              return query(args);
            },
          },
        },
      });
    }
    return this._extendedClient;
  }
}
