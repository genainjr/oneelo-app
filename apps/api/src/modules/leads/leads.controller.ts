import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateLeadDto) {
    await this.leadsService.create(dto);
    return { message: 'Solicitação recebida com sucesso. Entraremos em contato em breve.' };
  }
}
