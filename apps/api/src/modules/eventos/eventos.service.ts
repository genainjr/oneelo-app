import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { FilterEventosDto } from './dto/filter-eventos.dto';

@Injectable()
export class EventosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateEventoDto) {
    return this.prisma.evento.create({
      data: {
        ...dto,
        dataInicio: new Date(dto.dataInicio),
        dataFim: dto.dataFim ? new Date(dto.dataFim) : undefined,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, query: FilterEventosDto) {
    const where: any = { tenantId };

    if (query.status) {
      where.status = query.status;
    }

    // Filtro por período: eventos que se sobrepõem ao intervalo fornecido
    if (query.dataInicio || query.dataFim) {
      where.AND = [];

      if (query.dataInicio) {
        where.AND.push({
          dataInicio: { gte: new Date(query.dataInicio) },
        });
      }

      if (query.dataFim) {
        where.AND.push({
          dataInicio: { lte: new Date(query.dataFim) },
        });
      }
    }

    return this.prisma.evento.findMany({
      where,
      orderBy: { dataInicio: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const evento = await this.prisma.evento.findFirst({
      where: { id, tenantId },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return evento;
  }

  async update(tenantId: string, id: string, dto: UpdateEventoDto) {
    await this.findOne(tenantId, id);

    return this.prisma.evento.update({
      where: { id },
      data: {
        ...dto,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataFim: dto.dataFim ? new Date(dto.dataFim) : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.prisma.evento.delete({ where: { id } });

    return { message: 'Evento removido com sucesso.' };
  }
}
