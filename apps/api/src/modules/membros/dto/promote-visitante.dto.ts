import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class PromoteVisitanteDto {
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsBoolean()
  criarAcesso?: boolean;
}
