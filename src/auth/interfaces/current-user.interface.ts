import { UserRole } from '../../generated/prisma/enums'

export interface ICurrentUser {
  id: string
  email: string
  username: string
  role: UserRole
}

export interface ITokenData {
  id: string
  email: string
  username: string
  role: UserRole
}
