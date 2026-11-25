import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectFinancialTransactionDto {
  @ApiProperty({
    description: 'Motivo obrigatório da recusa do comprovante enviado pelo membro.',
    minLength: 5,
    maxLength: 500,
  })
  @IsString({ message: 'Informe o motivo da recusa.' })
  @MinLength(5, { message: 'O motivo da recusa deve ter pelo menos 5 caracteres.' })
  @MaxLength(500, { message: 'O motivo da recusa deve ter no máximo 500 caracteres.' })
  rejectionReason: string;
}
