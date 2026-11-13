import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateCustomDomainDto {
  @ApiProperty({
    description: 'Domínio próprio ou subdomínio da igreja (sem http:// ou barra final)',
    example: 'www.igrejaesperanca.org.br',
  })
  @IsString()
  @IsNotEmpty({ message: 'Informe o domínio personalizado da igreja.' })
  @MaxLength(253, { message: 'O domínio não pode ultrapassar 253 caracteres.' })
  customDomain: string;
}
