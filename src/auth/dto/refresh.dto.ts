import { IsString, IsNotEmpty } from 'class-validator'

/** Только для мобильного приложения и расширения — веб шлёт токен в куке */
export class RefreshDto {
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  readonly refreshToken: string
}
