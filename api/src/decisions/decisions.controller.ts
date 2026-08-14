import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { DecisionsService } from './decisions.service';

@Controller('groups/:groupId/decisions')
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Post('today')
  today(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.decisionsService.getOrPickToday(groupId, user.id);
  }

  @Get()
  history(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.decisionsService.history(groupId, user.id);
  }
}
