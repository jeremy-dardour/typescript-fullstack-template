import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/app/auth';
import { ApiUnauthorizedResponse } from '@/app/decorators';
import { currentUserSchema } from '@/modules/auth/dtos/current-user.dto';

import type { AuthenticatedUser } from '@/app/auth';
import type { CurrentUserDto } from '@/modules/auth/dtos/current-user.dto';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({ summary: 'The authenticated caller, as the API sees them' })
  @ApiOkResponse({ standardSchema: currentUserSchema })
  @ApiUnauthorizedResponse()
  me(@CurrentUser() user: AuthenticatedUser): CurrentUserDto {
    return { sub: user.sub, email: user.email, name: user.name };
  }
}
