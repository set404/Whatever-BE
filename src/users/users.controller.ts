import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { GlobalRole } from '../roles/global-role.enum';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Get('admin/users')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.Admin)
  listUsers() {
    return this.usersService.listAll();
  }

  @Patch('admin/users/:id/role')
  @UseGuards(RolesGuard)
  @Roles(GlobalRole.Superadmin)
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateGlobalRole(id, dto.role);
  }
}
