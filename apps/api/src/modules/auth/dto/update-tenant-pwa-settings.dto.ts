import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateTenantPwaSettingsDto {
  @ApiProperty({ description: 'Nome curto exibido no aplicativo instalado', example: 'CCRV', maxLength: 12 })
  @IsString()
  @IsNotEmpty({ message: 'Nome curto do aplicativo e obrigatorio.' })
  @MaxLength(12, { message: 'Nome curto deve ter no maximo 12 caracteres.' })
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N} .&'’-]*$/u, {
    message: 'Nome curto contem caracteres invalidos.',
  })
  shortName: string;
}
