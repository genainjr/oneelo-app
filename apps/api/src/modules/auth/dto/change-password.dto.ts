import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Senha atual do usuario; obrigatoria apenas quando a conta ja possui senha',
    example: 'senha-atual',
  })
  @IsOptional()
  @IsString()
  senhaAtual?: string;

  @ApiProperty({
    description: 'Nova senha de acesso',
    example: 'nova-senha',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Nova senha e obrigatoria.' })
  @MinLength(6, { message: 'Nova senha deve ter pelo menos 6 caracteres.' })
  novaSenha: string;
}
