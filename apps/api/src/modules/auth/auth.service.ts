import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
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
        }
      }
    });

    if (!user || user.status !== "ACTIVE" || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException("Login ou senha inválidos.");
    }

    const permissions = this.getEffectivePermissions(user.groups);
    const accessToken = await this.jwtService.signAsync({ sub: user.id, login: user.login, permissions });

    return {
      accessToken,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        permissions
      }
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { login: dto.login },
          ...(dto.email ? [{ email: dto.email }] : [])
        ]
      }
    });

    if (existingUser) {
      throw new BadRequestException("Já existe um usuário com este login ou email.");
    }

    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        name: dto.name,
        email: dto.email,
        passwordHash: hashPassword(dto.password),
        status: "PENDING",
        mustChangePassword: false
      },
      select: { id: true, login: true, name: true, email: true, status: true }
    });

    this.cache.delete("access:users");
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
              include: { permissions: { include: { permission: true } } }
            }
          }
        }
      }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Usuário inválido ou inativo.");
    }

    return {
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      permissions: this.getEffectivePermissions(user.groups)
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, email: dto.email || null }
    });

    this.cache.delete(`auth:profile:${userId}`);
    this.cache.delete("access:users");
    this.cache.delete(`access:user:${userId}`);
    return this.getProfile(userId);
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
}