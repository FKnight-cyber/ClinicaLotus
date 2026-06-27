import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import { AccessService } from "./access.service";
import { CreateAccessGroupDto } from "./dto/create-access-group.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateGroupPermissionsDto } from "./dto/update-group-permissions.dto";
import { UpdateUserGroupsDto } from "./dto/update-user-groups.dto";

@Controller("access")
@UseGuards(AuthGuard, PermissionsGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get("permissions")
  @RequirePermissions("access.groups.read")
  listPermissions() {
    return this.accessService.listPermissions();
  }

  @Get("groups")
  @RequirePermissions("access.groups.read")
  listGroups() {
    return this.accessService.listGroups();
  }

  @Post("groups")
  @RequirePermissions("access.groups.manage")
  createGroup(@Body() dto: CreateAccessGroupDto) {
    return this.accessService.createGroup(dto);
  }

  @Patch("groups/:groupId/permissions")
  @RequirePermissions("access.groups.manage")
  updateGroupPermissions(@Param("groupId") groupId: string, @Body() dto: UpdateGroupPermissionsDto) {
    return this.accessService.updateGroupPermissions(groupId, dto);
  }

  @Get("users")
  @RequirePermissions("access.users.read")
  listUsers() {
    return this.accessService.listUsers();
  }

  @Post("users")
  @RequirePermissions("access.users.manage")
  createUser(@Body() dto: CreateUserDto) {
    return this.accessService.createUser(dto);
  }

  @Patch("users/:userId/groups")
  @RequirePermissions("access.users.manage")
  updateUserGroups(@Param("userId") userId: string, @Body() dto: UpdateUserGroupsDto) {
    return this.accessService.updateUserGroups(userId, dto);
  }
}