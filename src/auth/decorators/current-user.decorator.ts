import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import { ICurrentUser } from '../interfaces/current-user.interface'

export const CurrentUser = createParamDecorator(
  (data: keyof ICurrentUser, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as ICurrentUser

    if (!user) return null

    return data ? user[data] : user
  }
)
