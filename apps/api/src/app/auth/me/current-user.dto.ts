import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({
    description: 'Stable subject identifier from the identity provider',
  })
  sub!: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  name?: string;
}
