import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator'

export class CreateCollectionDto {
  @IsString()
  @MinLength(2, { message: 'Name is too short' })
  @MaxLength(100, { message: 'Name is too long' })
  readonly name: string

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description is too long' })
  readonly description?: string

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'URL is too long' })
  readonly coverUrl?: string

  @IsOptional()
  @IsBoolean()
  readonly isPublic?: boolean
}
