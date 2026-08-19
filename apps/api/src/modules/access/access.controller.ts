import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
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
import { ListPasswordChangeRequestsQueryDto } from "./dto/list-password-change-requests-query.dto";
import { UpdateGroupPermissionsDto } from "./dto/update-group-permissions.dto";
import { UpdateUserClinicsDto } from "./dto/update-user-clinics.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateUserGroupsDto } from "./dto/update-user-groups.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";

@Controller("access")
@UseGuards(AuthGuard, PermissionsGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get("audit-logs")
  @RequirePermissions("audit.access.read")
  listAuditLogs(@Query() query: ListAccessAuditLogsQueryDto, @Req() request: { user: AuthenticatedUser }) {
    return this.accessService.listAuditLogs(query, request.user);
  }

  @Get("audit-logs/anamnesis")
  @RequirePermissions("audit.anamnesis.read")
  listAnamnesisAuditLogs(@Query() query: ListAccessAuditLogsQueryDto, @Req() request: { user: AuthenticatedUser }) {
    return this.accessService.listAnamnesisAuditLogs(query, request.user);
  }

  @Get("audit-logs/medical-evolutions")
  @RequirePermissions("audit.medical_evolutions.read")
  listMedicalEvolutionAuditLogs(@Query() query: ListAccessAuditLogsQueryDto, @Req() request: { user: AuthenticatedUser }) {
    return this.accessService.listMedicalEvolutionAuditLogs(query, request.user);
  }

  @Get("audit-logs/patients")
  @RequirePermissions("audit.patients.read")
  listPatientAuditLogs(@Query() query: ListAccessAuditLogsQueryDto, @Req() request: { user: AuthenticatedUser }) {
    return this.accessService.listPatientAuditLogs(query, request.user);
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

  @Get("password-change-requests")
  @RequirePermissions("access.password_changes.read")
  listPasswordChangeRequests(@Query() query: ListPasswordChangeRequestsQueryDto) {
    return this.accessService.listPasswordChangeRequests(query);
  }

  @Patch("password-change-requests/:requestId/approve")
  @RequirePermissions("access.password_changes.manage")
  approvePasswordChangeRequest(@Param("requestId") requestId: string, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.approvePasswordChangeRequest(requestId, request.user?.id);
  }

  @Patch("password-change-requests/:requestId/cancel")
  @RequirePermissions("access.password_changes.manage")
  cancelPasswordChangeRequest(@Param("requestId") requestId: string, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.cancelPasswordChangeRequest(requestId, request.user?.id);
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

  @Delete("groups/:groupId")
  @RequirePermissions("access.groups.manage")
  deleteGroup(@Param("groupId") groupId: string, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.deleteGroup(groupId, request.user?.id);
  }

  @Get("users")
  @RequirePermissions("access.users.read")
  listUsers(@Query() query: ListAccessUsersQueryDto) {
    return this.accessService.listUsers(query);
  }

  @Get("users/clinic-options")
  @RequirePermissions("access.users.clinics.manage")
  listActiveClinics() {
    return this.accessService.listActiveClinics();
  }

  @Get("users/clinic-assignments")
  @RequirePermissions("access.users.clinics.manage")
  listUserClinicAssignments(@Query() query: ListAccessUsersQueryDto) {
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
    const actorPermissions = request.user?.permissions ?? [];
    const canAssignClinics = actorPermissions.includes("admin.full_access") || actorPermissions.includes("access.users.clinics.manage");
    if (dto.clinicIds?.length && !canAssignClinics) {
      throw new ForbiddenException("Usuário sem permissão para atribuir clínicas.");
    }
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

  @Patch("users/me/clinics")
  @RequirePermissions("access.users.clinics.manage")
  updateOwnUserClinics(@Body() dto: UpdateUserClinicsDto, @Req() request: { user: AuthenticatedUser }) {
    return this.accessService.updateUserClinics(request.user.id, dto, request.user.id);
  }

  @Patch("users/:userId/clinics")
  @RequirePermissions("access.users.clinics.manage")
  updateUserClinics(@Param("userId") userId: string, @Body() dto: UpdateUserClinicsDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.updateUserClinics(userId, dto, request.user?.id);
  }

  @Delete("users/:userId")
  @RequirePermissions("access.users.manage")
  deleteUser(@Param("userId") userId: string, @Req() request: { user?: AuthenticatedUser }) {
    return this.accessService.deleteUser(userId, request.user?.id);
  }
}