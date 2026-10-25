import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/app/auth/decorators';
import { CurrentUserDto } from '@/app/auth/me/current-user.dto';
import { ApiUnauthorizedResponse } from '@/app/decorators/api-problem-responses.decorator';

import type { AuthenticatedUser } from '@/app/auth/types/token.types';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({ summary: 'The authenticated caller, as the API sees them' })
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiUnauthorizedResponse()
  me(@CurrentUser() user: AuthenticatedUser): CurrentUserDto {
    return { sub: user.sub, email: user.email, name: user.name };
  }
}
