import { IsString } from 'class-validator'

export class FriendRequestDto {
  @IsString({ message: 'Username is required' })
  readonly username: string
}
