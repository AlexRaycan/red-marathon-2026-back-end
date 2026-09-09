import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common'

import { UserRole } from '../../generated/prisma/enums'
import { ICurrentUser } from '../interfaces/current-user.interface'

@Injectable()
export class OnlyModeratorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as ICurrentUser

    if (user?.role !== UserRole.MODERATOR && user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission')
    }

    return true
  }
}
