import { CanActivate, Injectable, NotFoundException } from '@nestjs/common'

import { BILLING_ENABLED } from '../../constants/app.constants'

@Injectable()
export class BillingEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!BILLING_ENABLED) throw new NotFoundException()

    return true
  }
}
