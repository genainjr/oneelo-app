import { IsEmail, IsString, MinLength, IsEnum, IsBoolean, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'João da Silva',
    required: false,
  })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiProperty({
    description: 'Endereço de e-mail do usuário',
    example: 'joao@email.com',
    required: false,
  })
  @IsEmail({}, { message: 'E-mail inválido.' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Telefone internacional usado como credencial de login, ou null para remover',
    example: '+5511999999999',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(30, { message: 'Telefone deve ter no maximo 30 caracteres.' })
  telefoneLogin?: string | null;

  @ApiProperty({
    description: 'Senha de acesso do usuário (opcional na atualização)',
    example: '123456',
    minLength: 6,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres.' })
  senha?: string;

  @ApiProperty({
    description: 'Perfil de permissão do usuário',
    enum: Role,
    example: Role.BASIC,
    required: false,
  })
  @IsEnum(Role, { message: 'Perfil inválido.' })
  @IsOptional()
  role?: Role;

  @ApiProperty({
    description: 'Status ativo do usuário',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  @ApiProperty({
    description: 'ID do membro a vincular, ou null para desvincular',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  memberId?: string | null;
}
