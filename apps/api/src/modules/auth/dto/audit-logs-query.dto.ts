import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AcaoAuditoria } from '@prisma/client';

export class AuditLogsQueryDto {
  @ApiPropertyOptional({
    description: 'Pagina dos logs de auditoria.',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Quantidade de logs por pagina.',
    example: 15,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filtra logs por acao de auditoria.',
    enum: AcaoAuditoria,
    example: AcaoAuditoria.ATUALIZAR,
  })
  @IsOptional()
  @IsEnum(AcaoAuditoria)
  acao?: AcaoAuditoria;

  @ApiPropertyOptional({
    description: 'Filtra logs por recurso auditado.',
    example: 'user_auth_provider',
  })
  @IsOptional()
  @IsString()
  entidade?: string;

  @ApiPropertyOptional({
    description: 'Filtra logs por operador. Use "platform" para operadores Super Admin.',
    example: 'platform',
  })
  @IsOptional()
  @IsString()
  operador?: string;
}
