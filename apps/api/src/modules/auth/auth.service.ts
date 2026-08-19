import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestPasswordChangeDto } from "./dto/request-password-change.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { hashPassword, verifyPassword } from "./password";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cache: AppCacheService
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { login: dto.login },
      include: {
        groups: {
          include: {
            accessGroup: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        },
        passwordChangeRequests: { where: { status: "PENDING" }, select: { id: true }, take: 1 },
        clinics: {
          where: { status: "ACTIVE", clinic: { status: "ACTIVE" } },
          include: { clinic: true },
          orderBy: [{ isDefault: "desc" }, { assignedAt: "asc" }]
        }
      }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Login ou senha inválidos.");
    }

    if (user.passwordChangeRequests.length > 0) {
      throw new UnauthorizedException("Seu pedido de alteração de senha ainda não foi aprovado.");
    }

    if (!verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException("Login ou senha inválidos.");
    }

    const permissions = this.getEffectivePermissions(user.groups);
    const clinics = this.resolveClinicContext(user.clinics);
    const accessToken = await this.signAccessToken(user.id, user.login, permissions, clinics.map((clinic) => clinic.id));

    return {
      accessToken,
      clinics,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        userType: user.userType,
        professionalArea: user.professionalArea,
        professionalCouncil: user.professionalCouncil,
        professionalRegistration: user.professionalRegistration,
        professionalCouncilState: user.professionalCouncilState,
        professionalSpecialty: user.professionalSpecialty,
        mustChangePassword: user.mustChangePassword,
        permissions
      }
    };
  }

  async requestPasswordChange(dto: RequestPasswordChangeDto) {
    const login = dto.login.trim();
    const password = dto.password.trim();

    if (!login) {
      throw new BadRequestException("Informe o login.");
    }

    if (!password) {
      throw new BadRequestException("Informe a nova senha.");
    }

    const user = await this.prisma.user.findUnique({
      where: { login },
      select: { id: true, login: true, name: true, status: true }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new BadRequestException("Usuário não encontrado ou inativo.");
    }

    const pendingRequest = await this.prisma.passwordChangeRequest.findFirst({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { requestedAt: "desc" },
      select: { id: true, requestedAt: true, status: true }
    });
    const requestedPasswordHash = hashPassword(password);
    const passwordChangeRequest = pendingRequest
      ? await this.prisma.passwordChangeRequest.update({
        where: { id: pendingRequest.id },
        data: { requestedPasswordHash, requestedAt: new Date() },
        select: { id: true, requestedAt: true, status: true }
      })
      : await this.prisma.passwordChangeRequest.create({
        data: { userId: user.id, requestedPasswordHash },
        select: { id: true, requestedAt: true, status: true }
      });

    await this.prisma.auditLog.create({
      data: {
        entity: "access_user",
        entityId: user.id,
        action: "request_password_change",
        beforeData: pendingRequest ? JSON.stringify(pendingRequest) : null,
        afterData: JSON.stringify({ ...passwordChangeRequest, user: { id: user.id, login: user.login, name: user.name } }),
        reason: `Pedido de alteração de senha: ${user.name}`,
        userId: null
      }
    });
    this.cache.deleteByPrefix("access:password-change-requests:");
    this.cache.deleteByPrefix("access:audit-logs:");

    return { message: "Pedido de alteração de senha enviado para aprovação." };
  }

  async register(dto: RegisterDto) {
    const login = dto.login.trim();
    const name = dto.name.trim();
    const email = dto.email?.trim() || undefined;

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { login },
          { name },
          ...(email ? [{ email }] : [])
        ]
      }
    });

    if (existingUser) {
      if (existingUser.login === login) throw new BadRequestException("Já existe um usuário com este login.");
      if (existingUser.name === name) throw new BadRequestException("Já existe um usuário com este nome.");
      throw new BadRequestException("Já existe um usuário com este email.");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          login,
          name,
          email,
          passwordHash: hashPassword(dto.password),
          status: "PENDING",
          mustChangePassword: false
        },
        select: { id: true, login: true, name: true, email: true, status: true }
      });

      await tx.auditLog.create({
        data: {
          entity: "access_user",
          entityId: createdUser.id,
          action: "request_user_registration",
          beforeData: null,
          afterData: JSON.stringify(createdUser),
          reason: `Cadastro solicitado: ${createdUser.name}`,
          userId: null,
          clinicId: null
        }
      });

      return createdUser;
    });

    this.cache.deleteByPrefix("access:users:");
    this.cache.deleteByPrefix("access:audit-logs:");
    return {
      message: "Cadastro enviado para aprovação do administrador.",
      user
    };
  }

  async getProfile(userId: string) {
    return this.cache.getOrSet(`auth:profile:${userId}`, 30 * 1000, () => this.loadProfile(userId));
  }

  private async loadProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        groups: {
          include: {
            accessGroup: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        },
        clinics: {
          where: { status: "ACTIVE", clinic: { status: "ACTIVE" } },
          include: { clinic: true },
          orderBy: [{ isDefault: "desc" }, { assignedAt: "asc" }]
        }
      }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Usuário inválido ou inativo.");
    }

    const permissions = this.getEffectivePermissions(user.groups);
    const clinics = this.resolveClinicContext(user.clinics);

    return {
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      userType: user.userType,
      professionalArea: user.professionalArea,
      professionalCouncil: user.professionalCouncil,
      professionalRegistration: user.professionalRegistration,
      professionalCouncilState: user.professionalCouncilState,
      professionalSpecialty: user.professionalSpecialty,
      permissions,
      clinics
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!currentUser || currentUser.status !== "ACTIVE") {
      throw new UnauthorizedException("Usuário inválido ou inativo.");
    }

    const login = dto.login?.trim() || currentUser.login;
    const name = dto.name?.trim() || currentUser.name;
    const email = dto.email?.trim() || null;
    const professionalArea = dto.professionalArea?.trim() || null;
    const professionalCouncil = dto.professionalCouncil?.trim() || null;
    const professionalRegistration = dto.professionalRegistration?.trim() || null;
    const professionalCouncilState = dto.professionalCouncilState?.trim().toUpperCase() || null;
    const professionalSpecialty = dto.professionalSpecialty?.trim() || null;
    const password = dto.password?.trim();

    if (!login) {
      throw new BadRequestException("Informe o login.");
    }

    if (!name) {
      throw new BadRequestException("Informe o nome.");
    }

    if (login !== currentUser.login || name !== currentUser.name || email !== currentUser.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: [
            { login },
            { name },
            ...(email ? [{ email }] : [])
          ]
        },
        select: { id: true, login: true, name: true, email: true }
      });

      if (existingUser) {
        if (existingUser.login === login) throw new BadRequestException("Já existe um usuário com este login.");
        if (existingUser.name === name) throw new BadRequestException("Já existe um usuário com este nome.");
        throw new BadRequestException("Já existe um usuário com este email.");
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        login,
        name,
        email,
        professionalArea,
        professionalCouncil,
        professionalRegistration,
        professionalCouncilState,
        professionalSpecialty,
        ...(password ? { passwordHash: hashPassword(password), mustChangePassword: false } : {})
      }
    });

    this.cache.deleteByPrefix(`auth:profile:${userId}:`);
    this.cache.delete("access:users");
    this.cache.delete(`access:user:${userId}`);
    const updatedProfile = await this.getProfile(userId);
    await this.prisma.auditLog.create({
      data: {
        entity: "access_user",
        entityId: userId,
        action: "update_own_profile",
        beforeData: JSON.stringify({
          id: currentUser.id,
          login: currentUser.login,
          name: currentUser.name,
          email: currentUser.email,
          professionalArea: currentUser.professionalArea,
          professionalCouncil: currentUser.professionalCouncil,
          professionalRegistration: currentUser.professionalRegistration,
          professionalCouncilState: currentUser.professionalCouncilState,
          professionalSpecialty: currentUser.professionalSpecialty
        }),
        afterData: JSON.stringify(updatedProfile),
        reason: `Perfil atualizado: ${updatedProfile.name}`,
        userId
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
    return updatedProfile;
  }

  private getEffectivePermissions(groups: Array<{ accessGroup: { active: boolean; permissions: Array<{ permission: { key: string; active: boolean } }> } }>) {
    const permissions = new Set<string>();

    for (const group of groups) {
      if (!group.accessGroup.active) continue;
      for (const relation of group.accessGroup.permissions) {
        if (relation.permission.active) permissions.add(relation.permission.key);
      }
    }

    return [...permissions].sort();
  }

  private resolveClinicContext(
    clinics: Array<{ isDefault: boolean; clinic: { id: string; name: string; code: string | null; status: string } }>
  ) {
    return clinics.map(({ clinic, isDefault }) => ({ ...clinic, isDefault }));
  }

  private signAccessToken(userId: string, login: string, permissions: string[], availableClinicIds: string[]) {
    return this.jwtService.signAsync({ sub: userId, login, permissions, availableClinicIds });
  }
}