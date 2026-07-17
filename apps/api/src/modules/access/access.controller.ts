import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import { AccessService } from "./access.service";
import { CreateAccessGroupDto } from "./dto/create-access-group.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListAccessAuditLogsQueryDto } from "./dto/list-access-audit-logs-query.dto";
import { ListAccessGroupsQueryDto } from "./dto/list-access-groups-query.dto";
import { ListAccessUsersQueryDto } from "./dto/list-access-users-query.dto";
import { UpdateGroupPermissionsDto } from "./dto/update-group-permissions.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateUserGroupsDto } from "./dto/update-user-groups.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";

@Controller("access")
@UseGuards(AuthGuard, PermissionsGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get("audit-logs")
  @RequirePermissions("audit.access.read")
  listAuditLogs(@Query() query: ListAccessAuditLogsQueryDto) {
    return this.accessService.listAuditLogs(query);
  }

  @Get("permissions")
  @RequirePermissions("access.groups.read")
  listPermissions() {
    return this.accessService.listPermissions();
  }

  @Get("groups")
  @RequirePermissions("access.groups.read")
  listGroups(@Query() query: ListAccessGroupsQueryDto) {
    return this.accessService.listGroups(query);
  }

  @Post("groups")
  @RequirePermissions("access.groups.manage")
  createGroup(@Body() dto: CreateAccessGroupDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.createGroup(dto, request.user?.id);
  }

  @Patch("groups/:groupId/permissions")
  @RequirePermissions("access.groups.manage")
  updateGroupPermissions(@Param("groupId") groupId: string, @Body() dto: UpdateGroupPermissionsDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.updateGroupPermissions(groupId, dto, request.user?.id);
  }

  @Get("users")
  @RequirePermissions("access.users.read")
  listUsers(@Query() query: ListAccessUsersQueryDto) {
    return this.accessService.listUsers(query);
  }

  @Get("users/:userId")
  @RequirePermissions("access.users.read")
  getUser(@Param("userId") userId: string) {
    return this.accessService.getUser(userId);
  }

  @Post("users")
  @RequirePermissions("access.users.manage")
  createUser(@Body() dto: CreateUserDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.createUser(dto, request.user?.id);
  }

  @Patch("users/:userId")
  @RequirePermissions("access.users.manage")
  updateUser(@Param("userId") userId: string, @Body() dto: UpdateUserDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.updateUser(userId, dto, request.user?.id);
  }

  @Patch("users/:userId/status")
  @RequirePermissions("access.users.manage")
  updateUserStatus(@Param("userId") userId: string, @Body() dto: UpdateUserStatusDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.updateUserStatus(userId, dto, request.user?.id);
  }

  @Patch("users/:userId/groups")
  @RequirePermissions("access.users.manage")
  updateUserGroups(@Param("userId") userId: string, @Body() dto: UpdateUserGroupsDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.updateUserGroups(userId, dto, request.user?.id);
  }
}