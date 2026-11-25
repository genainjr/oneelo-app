import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixKeyType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertTenantPixConfigDto {
  @ApiProperty({ description: 'Ativa ou desativa a arrecadação PIX no portal de membros.' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Exibe a seção de Dízimos e Ofertas no site público da igreja.' })
  @IsBoolean()
  showOnPublicSite: boolean;

  @ApiProperty({ enum: PixKeyType })
  @IsEnum(PixKeyType, { message: 'Tipo de chave PIX inválido.' })
  pixKeyType: PixKeyType;

  @ApiProperty({ description: 'Chave PIX oficial da igreja.' })
  @IsString()
  @MaxLength(100)
  pixKey: string;

  @ApiProperty({ description: 'Nome do recebedor no padrão EMVCo (até 25 chars sem acentos).' })
  @IsString()
  @MaxLength(60)
  merchantName: string;

  @ApiProperty({ description: 'Cidade do recebedor no padrão EMVCo (até 15 chars sem acentos).' })
  @IsString()
  @MaxLength(40)
  merchantCity: string;

  @ApiPropertyOptional({ description: 'Prefixo TXID alfanumérico opcional (1 a 25 chars).' })
  @IsString()
  @MaxLength(25)
  @IsOptional()
  txidPrefix?: string | null;

  @ApiProperty({ description: 'ID da conta financeira ativa padrão para os lançamentos PIX.' })
  @IsString()
  defaultAccountId: string;
}
