import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'João da Silva',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  nome: string;

  @ApiProperty({
    description: 'Endereço de e-mail do usuário',
    example: 'joao@email.com',
  })
  @IsEmail({}, { message: 'E-mail inválido.' })
  @IsNotEmpty({ message: 'E-mail é obrigatório.' })
  email: string;

  @ApiProperty({
    description: 'Senha de acesso do usuário',
    example: '123456',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória.' })
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres.' })
  senha: string;

  @ApiProperty({
    description: 'Perfil de permissão do usuário',
    enum: Role,
    example: Role.BASIC,
  })
  @IsEnum(Role, { message: 'Perfil inválido.' })
  role: Role;

  @ApiProperty({
    description: 'Status ativo do usuário',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  @ApiProperty({
    description: 'ID do membro do cadastro pastoral a vincular (opcional)',
    example: 'uuid-do-membro',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  memberId?: string;
}
