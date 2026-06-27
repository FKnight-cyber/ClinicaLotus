import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { hashPassword } from "../auth/password";
import { CreateAccessGroupDto } from "./dto/create-access-group.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateGroupPermissionsDto } from "./dto/update-group-permissions.dto";
import { UpdateUserGroupsDto } from "./dto/update-user-groups.dto";

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
  }

  listGroups() {
    return this.prisma.accessGroup.findMany({
      orderBy: { name: "asc" },
      include: { permissions: { include: { permission: true } }, users: true }
    });
  }

  async createGroup(dto: CreateAccessGroupDto) {
    const group = await this.prisma.accessGroup.create({
      data: { name: dto.name, description: dto.description, active: true }
    });

    if (dto.permissionKeys?.length) {
      await this.setGroupPermissions(group.id, dto.permissionKeys);
    }

    return this.getGroup(group.id);
  }

  async updateGroupPermissions(groupId: string, dto: UpdateGroupPermissionsDto) {
    await this.getGroup(groupId);
    await this.setGroupPermissions(groupId, dto.permissionKeys);
    return this.getGroup(groupId);
  }

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        login: true,
        name: true,
        email: true,
        status: true,
        mustChangePassword: true,
        groups: { include: { accessGroup: true } }
      }
    });
  }

  async createUser(dto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        name: dto.name,
        email: dto.email,
        passwordHash: hashPassword(dto.password),
        status: "ACTIVE",
        mustChangePassword: true
      }
    });

    if (dto.groupIds?.length) {
      await this.setUserGroups(user.id, dto.groupIds);
    }

    return this.getUser(user.id);
  }

  async updateUserGroups(userId: string, dto: UpdateUserGroupsDto) {
    await this.getUser(userId);
    await this.setUserGroups(userId, dto.groupIds);
    return this.getUser(userId);
  }

  private async getGroup(groupId: string) {
    const group = await this.prisma.accessGroup.findUnique({
      where: { id: groupId },
      include: { permissions: { include: { permission: true } }, users: true }
    });

    if (!group) throw new NotFoundException("Grupo de acesso não encontrado.");
    return group;
  }

  private async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login: true,
        name: true,
        email: true,
        status: true,
        mustChangePassword: true,
        groups: { include: { accessGroup: true } }
      }
    });

    if (!user) throw new NotFoundException("Usuário não encontrado.");
    return user;
  }

  private async setGroupPermissions(groupId: string, permissionKeys: string[]) {
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
    await this.prisma.$transaction([
      this.prisma.accessGroupPermission.deleteMany({ where: { accessGroupId: groupId } }),
      ...permissions.map((permission) => this.prisma.accessGroupPermission.create({ data: { accessGroupId: groupId, permissionId: permission.id } }))
    ]);
  }

  private async setUserGroups(userId: string, groupIds: string[]) {
    await this.prisma.$transaction([
      this.prisma.userAccessGroup.deleteMany({ where: { userId } }),
      ...groupIds.map((accessGroupId) => this.prisma.userAccessGroup.create({ data: { userId, accessGroupId } }))
    ]);
  }
}