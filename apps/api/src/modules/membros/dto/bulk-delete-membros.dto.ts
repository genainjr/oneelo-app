import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BulkDeleteMembrosDto {
  @ApiProperty({
    description: 'Lista de IDs dos membros a serem excluídos em lote',
    example: ['d9b2d63d-a233-4123-8478-83b1fc981242'],
    isArray: true,
  })
  @IsArray({ message: 'O campo ids deve ser uma lista.' })
  @ArrayNotEmpty({ message: 'A lista de IDs não pode estar vazia.' })
  @ArrayMaxSize(500, { message: 'Não é possível excluir mais de 500 membros de uma vez.' })
  @IsUUID('4', { each: true, message: 'Cada ID fornecido deve ser um UUID válido.' })
  ids: string[];
}
