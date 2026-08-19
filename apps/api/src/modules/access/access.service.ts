import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { hashPassword } from "../auth/password";
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

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService
  ) {}

  listPermissions() {
    return this.cache.getOrSet("access:permissions", 5 * 60 * 1000, () => this.prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] }));
  }

  listActiveClinics() {
    return this.cache.getOrSet("access:clinic-options", 60 * 1000, () => this.prisma.clinic.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, document: true, status: true }
    }));
  }

  listAuditLogs(query: ListAccessAuditLogsQueryDto = {}, user?: AuthenticatedUser) {
    return this.listAuditLogsByScope(query, ["access_group", "access_user"], "access:audit-logs", undefined, user);
  }

  listAnamnesisAuditLogs(query: ListAccessAuditLogsQueryDto = {}, user?: AuthenticatedUser) {
    return this.listAuditLogsByScope(query, ["anamnesis_record", "AnamnesisRecord"], "access:audit-logs:anamnesis", [
      "create_anamnesis_template",
      "complete_anamnesis_template",
      "finalize_anamnesis",
      "emit_anamnesis_pdf",
      "emit_anamnesis_template_pdf",
      "COMPLETE_TEMPLATE",
      "FINALIZE",
      "EMIT_PDF",
      "EMIT_TEMPLATE_PDF"
    ], user);
  }

  listMedicalEvolutionAuditLogs(query: ListAccessAuditLogsQueryDto = {}, user?: AuthenticatedUser) {
    return this.listAuditLogsByScope(query, ["medical_evolution"], "access:audit-logs:medical-evolutions", ["finalize_medical_evolution"], user);
  }

  listPatientAuditLogs(query: ListAccessAuditLogsQueryDto = {}, user?: AuthenticatedUser) {
    return this.listAuditLogsByScope(query, ["patient"], "access:audit-logs:patients", [
      "create_patient",
      "update_patient",
      "activate_patient",
      "inactivate_patient",
      "emit_patient_summary_report_pdf",
      "link_existing_patient"
    ], user);
  }

  private listAuditLogsByScope(query: ListAccessAuditLogsQueryDto = {}, allowedEntities: string[], cachePrefix: string, allowedActions?: string[], user?: AuthenticatedUser) {
    const limit = this.normalizeListLimit(query.limit);
    const page = this.normalizePage(query.page);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const requestedEntity = query.entity?.trim();
    const entity = requestedEntity && allowedEntities.includes(requestedEntity) ? requestedEntity : undefined;
    const requestedAction = query.action?.trim();
    const action = requestedAction && (!allowedActions || allowedActions.includes(requestedAction)) ? requestedAction : undefined;
    const clinicId = this.resolveAuditClinicId(query.clinicId, user);
    const where = {
      entity: requestedEntity && !entity ? "__invalid_entity__" : entity ?? { in: allowedEntities },
      ...(clinicId ? { clinicId } : {}),
      ...(action ? { action } : allowedActions ? { action: { in: allowedActions } } : {}),
      ...(search ? { OR: [
        { action: { contains: search, mode: "insensitive" as const } },
        { reason: { contains: search, mode: "insensitive" as const } },
        { afterData: { contains: search, mode: "insensitive" as const } },
        { beforeData: { contains: search, mode: "insensitive" as const } }
      ] } : {})
    };

    return this.cache.getOrSet(`${cachePrefix}:${limit}:${page}:${search ?? ""}:${entity ?? ""}:${action ?? ""}:${clinicId ?? "all"}`, 30 * 1000, async () => {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: { user: { select: { id: true, name: true, login: true, email: true } }, clinic: { select: { id: true, name: true, code: true } } }
        }),
        this.prisma.auditLog.count({ where })
      ]);

      return { items, limit, page, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    });
  }

  listGroups(query: ListAccessGroupsQueryDto = {}) {
    const limit = this.normalizeGroupLimit(query.limit);
    const search = query.search?.trim();
    const where = search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } }
      ]
    } : undefined;

    return this.cache.getOrSet(`access:groups:${limit}:${search ?? ""}`, 60 * 1000, async () => {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.accessGroup.findMany({
          where,
          orderBy: { name: "asc" },
          take: limit,
          include: { permissions: { include: { permission: true } }, users: true }
        }),
        this.prisma.accessGroup.count({ where })
      ]);

      return { items, limit, total };
    });
  }

  listPasswordChangeRequests(query: ListPasswordChangeRequestsQueryDto = {}) {
    const limit = this.normalizeListLimit(query.limit);
    const page = this.normalizePage(query.page);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const status = query.status === "ALL" ? undefined : query.status ?? "PENDING";
    const where = {
      ...(status ? { status } : {}),
      ...(search ? { user: { is: { OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { login: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } }
      ] } } } : {})
    };

    return this.cache.getOrSet(`access:password-change-requests:${limit}:${page}:${search ?? ""}:${status ?? "ALL"}`, 30 * 1000, async () => {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.passwordChangeRequest.findMany({
          where,
          orderBy: { requestedAt: "desc" },
          skip,
          take: limit,
          select: this.passwordChangeRequestSelect()
        }),
        this.prisma.passwordChangeRequest.count({ where })
      ]);

      return { items, limit, page, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    });
  }

  approvePasswordChangeRequest(requestId: string, actorUserId?: string) {
    return this.reviewPasswordChangeRequest(requestId, "APPROVED", actorUserId);
  }

  cancelPasswordChangeRequest(requestId: string, actorUserId?: string) {
    return this.reviewPasswordChangeRequest(requestId, "CANCELED", actorUserId);
  }

  async createGroup(dto: CreateAccessGroupDto, actorUserId?: string) {
    const group = await this.prisma.accessGroup.create({
      data: { name: dto.name, description: dto.description, active: true }
    });

    if (dto.permissionKeys?.length) {
      await this.setGroupPermissions(group.id, dto.permissionKeys);
    }

    this.invalidateAccessCaches();
    const nextGroup = await this.getGroup(group.id);
    await this.createAccessAuditLog("access_group", group.id, "create_group", actorUserId, null, nextGroup, `Grupo criado: ${nextGroup.name}`);
    return nextGroup;
  }

  async updateGroupPermissions(groupId: string, dto: UpdateGroupPermissionsDto, actorUserId?: string) {
    const previousGroup = await this.getGroup(groupId);
    await this.setGroupPermissions(groupId, dto.permissionKeys);
    this.invalidateAccessCaches();
    const nextGroup = await this.getGroup(groupId);
    await this.createAccessAuditLog("access_group", groupId, "update_group_permissions", actorUserId, previousGroup, nextGroup, `Permissões atualizadas: ${nextGroup.name}`);
    return nextGroup;
  }

  listUsers(query: ListAccessUsersQueryDto = {}) {
    const limit = this.normalizeListLimit(query.limit);
    const search = query.search?.trim();
    const groupId = query.groupId?.trim();
    const clinicId = query.clinicId?.trim();
    const status = query.status;
    const filters: Prisma.UserWhereInput[] = [];

    if (search) {
      filters.push({ OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { login: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } }
      ] });
    }

    if (groupId) {
      filters.push({ groups: { some: { accessGroupId: groupId } } });
    }

    if (clinicId) {
      filters.push({ clinics: { some: { clinicId, status: "ACTIVE" } } });
    }

    const where: Prisma.UserWhereInput = {
      ...(filters.length > 0 ? { AND: filters } : {}),
      ...(status ? { status } : {})
    };

    return this.cache.getOrSet(`access:users:${limit}:${search ?? ""}:${groupId ?? ""}:${clinicId ?? ""}:${status ?? ""}`, 30 * 1000, async () => {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.user.findMany({
          where,
          orderBy: { name: "asc" },
          take: limit,
          select: {
            id: true,
            login: true,
            name: true,
            email: true,
            userType: true,
            professionalArea: true,
            status: true,
            mustChangePassword: true,
            groups: { include: { accessGroup: true } },
            clinics: { include: { clinic: true } }
          }
        }),
        this.prisma.user.count({ where })
      ]);

      return { items, limit, total };
    });
  }

  async createUser(dto: CreateUserDto, actorUserId?: string) {
    const login = dto.login.trim();
    const name = dto.name.trim();
    const email = dto.email?.trim() || undefined;

    if (!login) {
      throw new BadRequestException("Informe o usuário.");
    }

    if (!name) {
      throw new BadRequestException("Informe o nome.");
    }

    await this.ensureUniqueUserIdentity({ login, name, email });

    const user = await this.prisma.user.create({
      data: {
        login,
        name,
        email,
        passwordHash: hashPassword(dto.password),
        status: "ACTIVE",
        mustChangePassword: true
      }
    });

    if (dto.groupIds?.length) {
      await this.setUserGroups(user.id, dto.groupIds);
    }

    if (dto.clinicIds?.length) {
      await this.setUserClinics(user.id, dto.clinicIds);
    }

    this.invalidateAccessCaches(user.id);
    const nextUser = await this.getUser(user.id);
    await this.createAccessAuditLog("access_user", user.id, "create_user", actorUserId, null, nextUser, `Usuário criado: ${nextUser.name}`);
    return nextUser;
  }

  async updateUserGroups(userId: string, dto: UpdateUserGroupsDto, actorUserId?: string) {
    const previousUser = await this.getUser(userId);
    await this.setUserGroups(userId, dto.groupIds);
    this.invalidateAccessCaches(userId);
    const nextUser = await this.getUser(userId);
    await this.createAccessAuditLog("access_user", userId, "update_user_groups", actorUserId, previousUser, nextUser, `Grupos atualizados: ${nextUser.name}`);
    return nextUser;
  }

  async updateUserClinics(userId: string, dto: UpdateUserClinicsDto, actorUserId?: string) {
    const previousUser = await this.getUser(userId);

    if (previousUser.status === "ACTIVE" && dto.clinicIds.length === 0) {
      throw new BadRequestException("Um usuário ativo precisa ter ao menos uma clínica vinculada.");
    }

    await this.setUserClinics(
      userId,
      dto.clinicIds,
      previousUser.clinics.find((clinic) => clinic.isDefault)?.clinicId
    );
    this.invalidateAccessCaches(userId);
    const nextUser = await this.getUser(userId);
    await this.createAccessAuditLog("access_user", userId, "update_user_clinics", actorUserId, previousUser, nextUser, `Clínicas atualizadas: ${nextUser.name}`);
    return nextUser;
  }

  async updateUser(userId: string, dto: UpdateUserDto, actorUserId?: string) {
    const previousUser = await this.getUser(userId);
    const name = dto.name.trim();
    const email = dto.email?.trim() || null;

    if (!name) {
      throw new BadRequestException("Informe o nome.");
    }

    await this.ensureUniqueUserIdentity({ name, email: email ?? undefined, excludeUserId: userId });

    await this.prisma.user.update({
      where: { id: userId },
      data: { name, email, userType: dto.userType ?? previousUser.userType }
    });
    this.invalidateAccessCaches(userId);
    const nextUser = await this.getUser(userId);
    await this.createAccessAuditLog("access_user", userId, "update_user", actorUserId, previousUser, nextUser, `Dados atualizados: ${nextUser.name}`);
    return nextUser;
  }

  async deleteUser(userId: string, actorUserId?: string) {
    if (actorUserId && actorUserId === userId) {
      throw new BadRequestException("Não é permitido excluir o próprio usuário.");
    }

    const previousUser = await this.getUser(userId);

    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.anamnesisRecord.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
        tx.anamnesisRecord.updateMany({ where: { updatedById: userId }, data: { updatedById: null } }),
        tx.medicalRecordEntry.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
        tx.medicalEvolution.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
        tx.medicalEvolution.updateMany({ where: { updatedById: userId }, data: { updatedById: null } }),
        tx.medicalEvolution.updateMany({ where: { finalizedById: userId }, data: { finalizedById: null } }),
        tx.medicalEvolution.updateMany({ where: { canceledById: userId }, data: { canceledById: null } }),
        tx.clinicalDocument.updateMany({ where: { emittedById: userId }, data: { emittedById: null } }),
        tx.auditLog.updateMany({ where: { userId }, data: { userId: null } })
      ]);

      await tx.user.delete({ where: { id: userId } });
    });

    this.invalidateAccessCaches(userId);
    await this.createAccessAuditLog("access_user", userId, "delete_user", actorUserId, previousUser, null, `Usuário excluído: ${previousUser.name}`);
    return { id: userId };
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto, actorUserId?: string) {
    const previousUser = await this.getUser(userId);
    if (dto.status === "ACTIVE") {
      await this.ensureUserHasClinicScope(userId);
    }
    await this.prisma.user.update({ where: { id: userId }, data: { status: dto.status } });
    this.invalidateAccessCaches(userId);
    const nextUser = await this.getUser(userId);
    await this.createAccessAuditLog("access_user", userId, "update_user_status", actorUserId, previousUser, nextUser, `Status atualizado: ${nextUser.name}`);
    return nextUser;
  }

  private async getGroup(groupId: string) {
    const group = await this.prisma.accessGroup.findUnique({
      where: { id: groupId },
      include: { permissions: { include: { permission: true } }, users: true }
    });

    if (!group) throw new NotFoundException("Grupo de acesso não encontrado.");
    return group;
  }

  async getUser(userId: string) {
    const user = await this.cache.getOrSet(`access:user:${userId}`, 30 * 1000, () => this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login: true,
        name: true,
        email: true,
        userType: true,
        professionalArea: true,
        status: true,
        mustChangePassword: true,
        groups: { include: { accessGroup: true } },
        clinics: { include: { clinic: true } }
      }
    }));

    if (!user) throw new NotFoundException("Usuário não encontrado.");
    return user;
  }

  private async reviewPasswordChangeRequest(requestId: string, nextStatus: "APPROVED" | "CANCELED", actorUserId?: string) {
    const previousRequest = await this.prisma.passwordChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, login: true, name: true, email: true, status: true } },
        reviewedBy: { select: { id: true, login: true, name: true } }
      }
    });

    if (!previousRequest) throw new NotFoundException("Pedido de alteração de senha não encontrado.");
    if (previousRequest.status !== "PENDING") throw new BadRequestException("Este pedido de alteração de senha já foi analisado.");
    if (nextStatus === "APPROVED" && !previousRequest.requestedPasswordHash) throw new BadRequestException("Pedido de alteração de senha inválido.");

    const reviewedAt = new Date();
    if (nextStatus === "APPROVED") {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: previousRequest.userId },
          data: { passwordHash: previousRequest.requestedPasswordHash!, mustChangePassword: false }
        }),
        this.prisma.passwordChangeRequest.update({
          where: { id: requestId },
          data: { status: nextStatus, requestedPasswordHash: null, reviewedAt, reviewedById: actorUserId }
        })
      ]);
    } else {
      await this.prisma.passwordChangeRequest.update({
        where: { id: requestId },
        data: { status: nextStatus, requestedPasswordHash: null, reviewedAt, reviewedById: actorUserId }
      });
    }

    this.invalidateAccessCaches(previousRequest.userId);
    this.cache.deleteByPrefix("access:password-change-requests:");
    const nextRequest = await this.getPasswordChangeRequest(requestId);
    await this.createAccessAuditLog(
      "access_user",
      previousRequest.userId,
      nextStatus === "APPROVED" ? "approve_password_change_request" : "cancel_password_change_request",
      actorUserId,
      this.toPasswordChangeRequestResponse(previousRequest),
      nextRequest,
      `${nextStatus === "APPROVED" ? "Pedido de alteração de senha aprovado" : "Pedido de alteração de senha cancelado"}: ${previousRequest.user.name}`
    );
    return nextRequest;
  }

  private async getPasswordChangeRequest(requestId: string) {
    const passwordChangeRequest = await this.prisma.passwordChangeRequest.findUnique({
      where: { id: requestId },
      select: this.passwordChangeRequestSelect()
    });

    if (!passwordChangeRequest) throw new NotFoundException("Pedido de alteração de senha não encontrado.");
    return passwordChangeRequest;
  }

  private passwordChangeRequestSelect() {
    return {
      id: true,
      userId: true,
      status: true,
      requestedAt: true,
      reviewedAt: true,
      user: { select: { id: true, login: true, name: true, email: true, status: true } },
      reviewedBy: { select: { id: true, login: true, name: true } }
    };
  }

  private toPasswordChangeRequestResponse(passwordChangeRequest: { id: string; userId: string; status: string; requestedAt: Date; reviewedAt: Date | null; user: unknown; reviewedBy: unknown }) {
    return {
      id: passwordChangeRequest.id,
      userId: passwordChangeRequest.userId,
      status: passwordChangeRequest.status,
      requestedAt: passwordChangeRequest.requestedAt,
      reviewedAt: passwordChangeRequest.reviewedAt,
      user: passwordChangeRequest.user,
      reviewedBy: passwordChangeRequest.reviewedBy
    };
  }

  private invalidateAccessCaches(userId?: string) {
    this.cache.deleteByPrefix("access:groups:");
    this.cache.deleteByPrefix("access:users:");
    this.cache.deleteByPrefix("access:password-change-requests:");
    this.cache.deleteByPrefix("access:audit-logs:");
    this.cache.deleteByPrefix("auth:profile:");
    if (userId) this.cache.delete(`access:user:${userId}`);
  }

  private normalizeGroupLimit(limit?: number) {
    return this.normalizeListLimit(limit);
  }

  private resolveAuditClinicId(requestedClinicId?: string, user?: AuthenticatedUser) {
    const clinicId = requestedClinicId?.trim();
    if (!clinicId) return undefined;
    if (!user?.availableClinicIds.includes(clinicId)) throw new BadRequestException("Clínica fora do escopo do usuário.");
    return clinicId;
  }

  private normalizeListLimit(limit?: number) {
    if (typeof limit !== "number" || !Number.isFinite(limit)) return 5;
    return Math.min(Math.max(Math.trunc(limit), 1), 100);
  }

  private normalizePage(page?: number) {
    if (typeof page !== "number" || !Number.isFinite(page)) return 1;
    return Math.max(Math.trunc(page), 1);
  }

  private async ensureUniqueUserIdentity({
    login,
    name,
    email,
    excludeUserId
  }: {
    login?: string;
    name?: string;
    email?: string;
    excludeUserId?: string;
  }) {
    const whereFilters: Prisma.UserWhereInput[] = [];

    if (login) whereFilters.push({ login });
    if (name) whereFilters.push({ name });
    if (email) whereFilters.push({ email });

    if (whereFilters.length === 0) return;

    const existingUsers = await this.prisma.user.findMany({
      where: {
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        OR: whereFilters
      },
      select: { id: true, login: true, name: true, email: true }
    });

    if (login && existingUsers.some((user) => user.login === login)) {
      throw new BadRequestException("Já existe um usuário com este login.");
    }

    if (name && existingUsers.some((user) => user.name === name)) {
      throw new BadRequestException("Já existe um usuário com este nome.");
    }

    if (email && existingUsers.some((user) => user.email === email)) {
      throw new BadRequestException("Já existe um usuário com este email.");
    }
  }

  private async createAccessAuditLog(entity: "access_group" | "access_user", entityId: string, action: string, actorUserId: string | undefined, beforeData: unknown, afterData: unknown, reason: string) {
    await this.prisma.auditLog.create({
      data: {
        entity,
        entityId,
        action,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: afterData ? JSON.stringify(afterData) : null,
        reason,
        userId: actorUserId
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
  }

  private async setGroupPermissions(groupId: string, permissionKeys: string[]) {
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
    await this.prisma.$transaction([
      this.prisma.accessGroupPermission.deleteMany({ where: { accessGroupId: groupId } }),
      ...permissions.map((permission) => this.prisma.accessGroupPermission.create({ data: { accessGroupId: groupId, permissionId: permission.id } }))
    ]);
  }

  private async setUserClinics(userId: string, clinicIds: string[], currentDefaultClinicId?: string) {
    const uniqueClinicIds = [...new Set(clinicIds.filter((clinicId) => clinicId.trim().length > 0))];
    const clinics = await this.prisma.clinic.findMany({ where: { id: { in: uniqueClinicIds }, status: "ACTIVE" }, select: { id: true } });

    if (clinics.length !== uniqueClinicIds.length) {
      throw new BadRequestException("Uma ou mais clínicas informadas não foram encontradas ou estão inativas.");
    }

    const defaultClinicId = currentDefaultClinicId && uniqueClinicIds.includes(currentDefaultClinicId)
      ? currentDefaultClinicId
      : uniqueClinicIds[0];

    await this.prisma.$transaction([
      this.prisma.userClinic.deleteMany({ where: { userId } }),
      ...uniqueClinicIds.map((clinicId) => this.prisma.userClinic.create({
        data: { userId, clinicId, status: "ACTIVE", isDefault: clinicId === defaultClinicId }
      }))
    ]);
  }

  private async setUserGroups(userId: string, groupIds: string[]) {
    await this.prisma.$transaction([
      this.prisma.userAccessGroup.deleteMany({ where: { userId } }),
      ...groupIds.map((accessGroupId) => this.prisma.userAccessGroup.create({ data: { userId, accessGroupId } }))
    ]);
  }

  private async ensureUserHasClinicScope(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        clinics: { where: { status: "ACTIVE", clinic: { status: "ACTIVE" } }, select: { clinicId: true }, take: 1 }
      }
    });

    const hasUserClinic = (user?.clinics.length ?? 0) > 0;

    if (!hasUserClinic) {
      throw new BadRequestException("Vincule ao menos uma clínica ao usuário antes de ativar o cadastro.");
    }
  }
}