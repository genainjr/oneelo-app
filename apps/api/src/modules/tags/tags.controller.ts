import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';

@Controller('tags')
@Roles(Role.ADMIN, Role.STAFF)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@Body() createTagDto: CreateTagDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.tagsService.create(tenantId, createTagDto);
  }

  @Get()
  findAll(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.tagsService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.tagsService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.tagsService.update(tenantId, id, updateTagDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.tagsService.remove(tenantId, id);
  }
}
