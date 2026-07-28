import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedUser } from "../auth.types";
import { AuthService } from "../auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException("Token de autenticação não informado.");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; login: string; permissions?: string[] }>(token);
      const profile = await this.authService.getProfile(payload.sub);
      request.user = {
        id: profile.id,
        login: profile.login,
        name: profile.name,
        permissions: profile.permissions
      };
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado.");
    }
  }
}