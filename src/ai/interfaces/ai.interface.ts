export interface IChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface IChatCompletionChoice {
  message?: { content?: string }
}

export interface IChatCompletionResponse {
  choices?: IChatCompletionChoice[]
  error?: { message?: string }
}

/** Кратко о тайтле — то, что уходит в промпт вместо всей записи из базы */
export interface ITitleBrief {
  name: string
  type: string
  rating?: number | null
  genres: string[]
}

/** Что модель знает о вкусе пользователя */
export interface ITasteContext {
  favoriteGenres: string[]
  topRated: ITitleBrief[]
  recentlyCompleted: ITitleBrief[]
  inProgress: ITitleBrief[]
  averageRating: number | null
}
