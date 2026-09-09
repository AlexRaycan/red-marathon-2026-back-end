import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator'

import { TitleType } from '../../generated/prisma/enums'

/** Сколько времени человек готов потратить */
export const PickerDurationEnum = {
  Short: 'short',
  Medium: 'medium',
  Long: 'long'
} as const

export type PickerDurationEnum =
  (typeof PickerDurationEnum)[keyof typeof PickerDurationEnum]

/**
 * Все поля опциональны: если прислать пустой объект, модель подберёт
 * что-то по одному лишь вкусу пользователя — кнопка «удиви меня»
 */
export class PickerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Mood description is too long' })
  readonly mood?: string

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(TitleType, { each: true, message: 'Unknown title type' })
  readonly type?: TitleType[]

  @IsOptional()
  @IsEnum(PickerDurationEnum, { message: 'Unknown duration' })
  readonly duration?: PickerDurationEnum

  /** Не предлагать то, что уже есть в библиотеке */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  readonly excludeLibrary?: boolean = true
}
