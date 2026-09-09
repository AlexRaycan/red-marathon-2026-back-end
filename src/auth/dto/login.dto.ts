import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email' })
  @MaxLength(100, { message: 'Email is too long' })
  readonly email: string

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(100, { message: 'Password is too long' })
  readonly password: string
}
