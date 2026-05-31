import { IsArray, IsString, IsEnum } from 'class-validator';

export class BulkTagMembrosDto {
  @IsArray()
  @IsString({ each: true })
  membrosIds: string[];

  @IsArray()
  @IsString({ each: true })
  tagsIds: string[];

  @IsEnum(['ADD', 'REMOVE'])
  acao: 'ADD' | 'REMOVE';
}
