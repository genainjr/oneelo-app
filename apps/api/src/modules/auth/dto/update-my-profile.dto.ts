import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMyProfileDto {
  @ApiProperty({
    description: 'Nome completo do usuario autenticado',
    example: 'Joao da Silva',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(120, { message: 'Nome completo deve ter no maximo 120 caracteres.' })
  nome?: string;

  @ApiProperty({
    description: 'Nome de impressao do membro vinculado',
    example: 'Joao',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(120, { message: 'Nome de impressao deve ter no maximo 120 caracteres.' })
  nomeExibicao?: string | null;

  @ApiProperty({
    description: 'Telefone/WhatsApp do membro vinculado',
    example: '(11) 99999-9999',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(30, { message: 'Telefone deve ter no maximo 30 caracteres.' })
  whatsapp?: string | null;
}
