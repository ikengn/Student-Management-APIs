import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from './role.decorator.js';

@Injectable()
export class RoleGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const roles = this.reflector.get(Roles, context.getHandler());
        if (!roles) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user || !await this.matchRoles(user.role, roles)) {
            throw new ForbiddenException('Access denied');
        }
        return true;
    }

    async matchRoles(userRole: string, roles: string[]): Promise<boolean> {
        return roles.includes(userRole);
    }
}