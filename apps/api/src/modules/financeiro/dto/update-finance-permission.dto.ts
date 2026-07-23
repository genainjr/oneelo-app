import { ApiProperty } from '@nestjs/swagger';
import { FinanceRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateFinancePermissionDto {
  @ApiProperty({
    description: 'Permissao financeira do usuario. Omitir/null remove o acesso financeiro.',
    enum: FinanceRole,
    required: false,
    nullable: true,
  })
  @IsEnum(FinanceRole, { message: 'Permissao financeira invalida.' })
  @IsOptional()
  role?: FinanceRole | null;
}
