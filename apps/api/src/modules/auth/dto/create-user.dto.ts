import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome completo do usuario',
    example: 'Joao da Silva',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nome e obrigatorio.' })
  nome: string;

  @ApiProperty({
    description: 'Endereco de e-mail do usuario',
    example: 'joao@email.com',
  })
  @IsEmail({}, { message: 'E-mail invalido.' })
  @IsNotEmpty({ message: 'E-mail e obrigatorio.' })
  email: string;

  @ApiProperty({
    description: 'Senha de acesso do usuario. Quando omitida, o usuario fica pendente de ativacao.',
    example: '123456',
    minLength: 6,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres.' })
  senha?: string;

  @ApiProperty({
    description: 'Perfil de permissao do usuario',
    enum: Role,
    example: Role.BASIC,
  })
  @IsEnum(Role, { message: 'Perfil invalido.' })
  role: Role;

  @ApiProperty({
    description: 'Status ativo do usuario',
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
