import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({
    description: 'E-mail ou telefone internacional do usuario',
    example: '+5511999999999',
  })
  @IsString()
  @IsOptional()
  identificador?: string;

  @ApiPropertyOptional({
    description: 'Alias legado para clientes que ainda enviam e-mail',
    example: 'admin@oneelo.com',
  })
  @IsEmail({}, { message: 'E-mail invalido.' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Senha de acesso do usuario',
    example: '123456',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Senha e obrigatoria.' })
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres.' })
  senha: string;
}
