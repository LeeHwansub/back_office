import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/session.service';
import { CreateUserDto } from './dto/create-user.dto';
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
}
