import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "../auth.types";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    if (required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const userPermissions = new Set(request.user?.permissions ?? []);

    if (userPermissions.has("admin.full_access") || required.every((permission) => userPermissions.has(permission))) {
      return true;
    }

    throw new ForbiddenException("Usuário sem permissão para executar esta ação.");
  }
}