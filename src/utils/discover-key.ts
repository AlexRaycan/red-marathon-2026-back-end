import { BadRequestException } from '@nestjs/common'

import { ExternalSource, TitleType } from '../generated/prisma/enums'

export interface IDiscoverKey {
  source: ExternalSource
  type: TitleType
  externalId: string
}

/**
 * Ключ собирает всё, что нужно, чтобы найти тайтл во внешнем API:
 * источник, тип (TMDB хранит фильмы и сериалы раздельно) и внешний id.
 * Регистр меняем только у источника и типа: id книг Google
 * регистрозависимый — `XdMbTkWsFeMC` в нижнем регистре даёт 404
 */
export function toDiscoverKey({
  source,
  type,
  externalId
}: IDiscoverKey): string {
  const prefix = `${source}-${type}`.toLowerCase()

  return `${prefix}-${externalId}`
}

/**
 * В источнике и типе дефисов нет, а в id книг Google бывают —
 * поэтому всё после второго дефиса считаем id
 */
export function parseDiscoverKey(key: string): IDiscoverKey {
  const [rawSource = '', rawType = '', ...rest] = key.split('-')

  const source = rawSource.toUpperCase()
  const type = rawType.toUpperCase()
  const externalId = rest.join('-')

  const isValid =
    (Object.values(ExternalSource) as string[]).includes(source) &&
    (Object.values(TitleType) as string[]).includes(type) &&
    Boolean(externalId)

  if (!isValid) throw new BadRequestException('Invalid title key')

  return {
    source: source as ExternalSource,
    type: type as TitleType,
    externalId
  }
}
