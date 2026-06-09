import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Senha atual do usuario',
    example: 'senha-atual',
  })
  @IsString()
  @IsNotEmpty({ message: 'Senha atual e obrigatoria.' })
  senhaAtual: string;

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
