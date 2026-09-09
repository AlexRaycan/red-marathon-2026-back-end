import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator'

/** Добавление и удаление тайтлов пачкой — экран «добавить в подборку» */
export class CollectionTitlesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Title list is empty' })
  @ArrayMaxSize(50, { message: 'Maximum 50 titles at a time' })
  @IsString({ each: true })
  readonly titleIds: string[]
}
