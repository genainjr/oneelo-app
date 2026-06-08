import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        telefone: dto.telefone,
        mensagem: dto.mensagem,
      },
      select: { id: true, nome: true, email: true, createdAt: true },
    });
  }
}
