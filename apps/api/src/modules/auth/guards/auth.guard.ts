import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedUser } from "../auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException("Token de autenticação não informado.");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; login: string; permissions: string[] }>(token);
      request.user = {
        id: payload.sub,
        login: payload.login,
        name: payload.login,
        permissions: payload.permissions ?? []
      };
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado.");
    }
  }
}