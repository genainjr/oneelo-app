import { IsString, IsOptional } from 'class-validator';

export class AddMembroMinisterioDto {
  @IsString()
  membroId: string;
}

export class AddLiderMinisterioDto {
  @IsString()
  userId: string;
}
