import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateAccountDto {
  @ApiProperty({
    description: 'Senha que sera cadastrada na ativacao da conta',
    example: '123456',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Senha e obrigatoria.' })
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres.' })
  senha: string;

  @ApiProperty({
    description: 'Confirmacao da senha',
    example: '123456',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Confirmacao de senha e obrigatoria.' })
  @MinLength(6, { message: 'Confirmacao deve ter pelo menos 6 caracteres.' })
  confirmarSenha: string;
}
