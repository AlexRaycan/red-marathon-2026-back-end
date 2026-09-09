import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator'

/** Кому отправляем — выбираем из своего списка друзей */
export class ShareCollectionDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Recipient list is empty' })
  @ArrayMaxSize(20, { message: 'Maximum 20 recipients at a time' })
  @IsString({ each: true })
  readonly friendIds: string[]
}
