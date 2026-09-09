import { randomInt } from 'crypto'

/** «user_4821» — юзер меняет его в профиле, когда захочет */
export function generateUsername(): string {
  return `user_${randomInt(1000, 999999)}`
}
