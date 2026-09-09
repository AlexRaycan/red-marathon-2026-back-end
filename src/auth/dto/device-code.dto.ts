import { IsString, Matches } from 'class-validator'

export class DeviceCodeDto {
  @IsString()
  @Matches(/^\d{3}-\d{3}$/, { message: 'Code must be in 123-456 format' })
  readonly code: string
}
