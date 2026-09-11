import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from './role.decorator.js';
import { UsersService } from '../../users/users.service.js';

@Injectable()
export class RoleGuard implements CanActivate {
    constructor(private reflector: Reflector, private userService: UsersService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const roles = this.reflector.get(Roles, context.getHandler());
        if (!roles) {
            return true;
        }

        const user = await this.userService.findById(context.switchToHttp().getRequest().user.sub);
        if (!user || !await this.matchRoles(user.role, roles)) {
            throw new ForbiddenException('Access denied');
        }
        return true;
    }

    async matchRoles(userRole: string, roles: string[]): Promise<boolean> {
        return roles.includes(userRole);
    }
}