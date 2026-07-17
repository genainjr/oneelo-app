import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLoginPhoneDto {
  @ApiProperty({
    description: 'Senha atual para confirmar a alteracao da credencial',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Senha atual e obrigatoria.' })
  senhaAtual: string;

  @ApiProperty({
    description: 'Telefone internacional de login ou null para remover',
    example: '+5511999999999',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(30, { message: 'Telefone deve ter no maximo 30 caracteres.' })
  telefoneLogin?: string | null;
}
