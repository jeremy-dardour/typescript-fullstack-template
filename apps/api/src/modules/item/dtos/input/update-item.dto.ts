import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { IsOptionalNotNull } from '@/shared/decorators/is-optional-not-null.decorator';

export class UpdateItemDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @IsString()
  @IsOptionalNotNull()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsString()
  @IsOptional()
  description?: string;
}
