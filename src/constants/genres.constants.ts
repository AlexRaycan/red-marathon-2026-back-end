export interface IGenre {
  slug: string
  label: string
  /**
   * Как жанр называется у TMDB и Google Books. По этим названиям фильтруем
   * выдачу после слияния: у них нет фильтра по жанру вместе с текстовым поиском
   */
  aliases: string[]
  /** Slug жанра в RAWG; без него в играх такого жанра нет */
  rawg?: string
  /** Id жанра в Shikimori; без него в аниме такого жанра нет */
  shikimori?: string
}

/**
 * Общий список жанров для фронта. Названия у источников разные
 * («Science Fiction», «Sci-Fi & Fantasy», «Sci-Fi»), поэтому
 * сводим их к своему slug вручную
 */
export const GENRES: IGenre[] = [
  {
    slug: 'action',
    label: 'Action',
    aliases: ['action'],
    rawg: 'action',
    shikimori: '1'
  },
  {
    slug: 'adventure',
    label: 'Adventure',
    aliases: ['adventure'],
    rawg: 'adventure',
    shikimori: '2'
  },
  { slug: 'comedy', label: 'Comedy', aliases: ['comedy'], shikimori: '4' },
  { slug: 'crime', label: 'Crime', aliases: ['crime'] },
  { slug: 'drama', label: 'Drama', aliases: ['drama'], shikimori: '8' },
  { slug: 'fantasy', label: 'Fantasy', aliases: ['fantasy'], shikimori: '10' },
  { slug: 'horror', label: 'Horror', aliases: ['horror'], shikimori: '14' },
  { slug: 'mystery', label: 'Mystery', aliases: ['mystery'], shikimori: '7' },
  { slug: 'romance', label: 'Romance', aliases: ['romance'], shikimori: '22' },
  {
    slug: 'sci-fi',
    label: 'Sci-Fi',
    aliases: ['science fiction', 'sci fi'],
    shikimori: '24'
  },
  {
    slug: 'thriller',
    label: 'Thriller',
    aliases: ['thriller', 'suspense'],
    shikimori: '117'
  },
  {
    slug: 'sports',
    label: 'Sports',
    aliases: ['sport'],
    rawg: 'sports',
    shikimori: '30'
  },
  {
    slug: 'rpg',
    label: 'RPG',
    aliases: ['role playing', 'rpg'],
    rawg: 'role-playing-games-rpg'
  },
  {
    slug: 'strategy',
    label: 'Strategy',
    aliases: ['strategy'],
    rawg: 'strategy'
  },
  { slug: 'shooter', label: 'Shooter', aliases: ['shooter'], rawg: 'shooter' },
  {
    slug: 'simulation',
    label: 'Simulation',
    aliases: ['simulation'],
    rawg: 'simulation'
  },
  { slug: 'puzzle', label: 'Puzzle', aliases: ['puzzle'], rawg: 'puzzle' },
  { slug: 'racing', label: 'Racing', aliases: ['racing'], rawg: 'racing' }
]

/** Список slug для валидации и OpenAPI-enum `GenreSlug` */
export const GENRE_SLUGS = GENRES.map(({ slug }) => slug)
