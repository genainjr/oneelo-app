import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  EstadoCivil,
  SexoMembro,
  TipoSolicitacaoCadastro,
} from '@prisma/client';

export class SubmitMemberRegistrationDto {
  @IsEnum(TipoSolicitacaoCadastro, {
    message: 'Tipo de cadastro deve ser VISITANTE ou MEMBRO.',
  })
  tipo: TipoSolicitacaoCadastro;

  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  @MinLength(3, { message: 'Nome deve ter no mínimo 3 caracteres.' })
  nome: string;

  @IsString()
  @IsNotEmpty({ message: 'Telefone / WhatsApp é obrigatório.' })
  telefone: string;

  // E-mail obrigatório se tipo for MEMBRO
  @ValidateIf(
    (o: SubmitMemberRegistrationDto) =>
      o.tipo === TipoSolicitacaoCadastro.MEMBRO || Boolean(o.email),
  )
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsNotEmpty({ message: 'E-mail é obrigatório para cadastro de membro.' })
  email?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de nascimento inválida.' })
  dataNascimento?: string;

  @IsOptional()
  @IsEnum(SexoMembro, { message: 'Sexo inválido.' })
  sexo?: SexoMembro;

  @IsOptional()
  @IsEnum(EstadoCivil, { message: 'Estado civil inválido.' })
  estadoCivil?: EstadoCivil;

  @IsOptional()
  @IsBoolean()
  batizadoAguas?: boolean;

  @IsOptional()
  @IsString()
  igrejaAnterior?: string;

  @IsOptional()
  @IsString()
  quemConvidou?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsBoolean({ message: 'É obrigatório aceitar os termos de consentimento.' })
  consentimentoLgpd: boolean;

  // Campo armadilha invisível (honeypot). Usuários reais deixam vazio; bots preenchem.
  @IsOptional()
  @IsString()
  website?: string;
}
