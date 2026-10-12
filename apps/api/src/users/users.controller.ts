import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/session.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserSummary, UsersService } from './users.service';

@Controller('users')
@UseGuards(SessionGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('USER_READ')
  list(): Promise<UserSummary[]> {
    return this.usersService.list();
  }

  @Post()
  @RequirePermission('USER_CREATE')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateUserDto,
  ): Promise<UserSummary> {
    return this.usersService.create(actor, body);
  }

  @Patch(':id/status')
  @RequirePermission('USER_UPDATE')
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserStatusDto,
  ): Promise<UserSummary> {
    return this.usersService.updateStatus(actor, id, body.status);
  }

  @Patch(':id/role')
  @RequirePermission('USER_UPDATE')
  updateRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRoleDto,
  ): Promise<UserSummary> {
    return this.usersService.updateRole(actor, id, body.roleCode);
  }
}
