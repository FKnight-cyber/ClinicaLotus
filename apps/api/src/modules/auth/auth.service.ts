import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { verifyPassword } from "./password";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
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

  async getProfile(userId: string) {
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