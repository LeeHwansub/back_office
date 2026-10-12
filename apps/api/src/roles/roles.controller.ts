import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/session.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { PermissionView, RolesService, RoleView } from './roles.service';

@Controller()
@UseGuards(SessionGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  listRoles(): Promise<RoleView[]> {
    return this.rolesService.listRoles();
  }

  @Get('permissions')
  listPermissions(): Promise<PermissionView[]> {
    return this.rolesService.listPermissions();
  }

  @Put('roles/:code/permissions')
  @RequirePermission('ROLE_PERMISSION_UPDATE')
  updatePermissions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('code') code: string,
    @Body() body: UpdateRolePermissionsDto,
  ): Promise<RoleView> {
    return this.rolesService.updatePermissions(
      actor,
      code,
      body.permissionCodes,
    );
  }
}
