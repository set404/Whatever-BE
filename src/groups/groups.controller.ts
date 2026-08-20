import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteByEmailDto } from './dto/invite-by-email.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto.name);
  }

  @Post('join')
  join(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinGroupDto) {
    return this.groupsService.joinByCode(user.id, dto.code, user.email);
  }

  @Public()
  @Get('invitations/:code')
  getInvitationInfo(@Param('code') code: string) {
    return this.groupsService.getInvitationInfo(code);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.groupsService.getOne(user.id, id);
  }

  @Get(':id/members')
  getMembers(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.groupsService.getMembers(user.id, id);
  }

  @Post(':id/invitations')
  invite(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.groupsService.createInvitation(user.id, id);
  }

  @Post(':id/invitations/email')
  inviteByEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InviteByEmailDto,
  ) {
    return this.groupsService.inviteByEmail(user.id, id, dto.email);
  }
}
