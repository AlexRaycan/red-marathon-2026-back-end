import { applyDecorators, UseGuards } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'

import { UserRole } from '../../generated/prisma/enums'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import { OnlyAdminGuard } from '../guards/only-admin.guard'
import { OnlyModeratorGuard } from '../guards/only-moderator.guard'

export const Auth = (role: UserRole = UserRole.USER) => {
  if (role === UserRole.ADMIN) {
    return applyDecorators(
      UseGuards(JwtAuthGuard, OnlyAdminGuard),
      ApiBearerAuth()
    )
  }

  if (role === UserRole.MODERATOR) {
    return applyDecorators(
      UseGuards(JwtAuthGuard, OnlyModeratorGuard),
      ApiBearerAuth()
    )
  }

  return applyDecorators(UseGuards(JwtAuthGuard), ApiBearerAuth())
}
