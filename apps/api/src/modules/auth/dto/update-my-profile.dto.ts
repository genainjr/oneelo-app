import { ApiProperty } from '@nestjs/swagger';
import { EstadoCivil, SexoMembro } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiProperty({
    description: 'CPF do membro',
    example: '123.456.789-00',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'CPF deve ter no maximo 20 caracteres.' })
  cpf?: string | null;

  @ApiProperty({
    description: 'RG do membro',
    example: '12.345.678-9',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(30, { message: 'RG deve ter no maximo 30 caracteres.' })
  rg?: string | null;

  @ApiProperty({
    description: 'Data de nascimento (formato ISO ou YYYY-MM-DD)',
    example: '1990-05-15',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  dataNascimento?: string | null;

  @ApiProperty({
    description: 'Data de batismo (formato ISO ou YYYY-MM-DD)',
    example: '2005-08-20',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  dataBatismo?: string | null;

  @ApiProperty({
    description: 'Estado civil do membro',
    enum: EstadoCivil,
    required: false,
    nullable: true,
  })
  @IsEnum(EstadoCivil, { message: 'Estado civil invalido.' })
  @IsOptional()
  estadoCivil?: EstadoCivil | null;

  @ApiProperty({
    description: 'Sexo do membro',
    enum: SexoMembro,
    required: false,
    nullable: true,
  })
  @IsEnum(SexoMembro, { message: 'Sexo invalido.' })
  @IsOptional()
  sexo?: SexoMembro | null;
}
