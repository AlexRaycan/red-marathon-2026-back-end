import { TitleType } from '../../generated/prisma/enums'
import { TitleListItemResponse } from '../../title/response/title-response'

export class AiSuggestionResponse {
  name: string
  type: TitleType
  /** Почему модель это предложила */
  reason: string
  /** Заполнен, если тайтл уже есть в нашей базе */
  title: TitleListItemResponse | null
}

export class AiSuggestionsResponse {
  items: AiSuggestionResponse[]
}

export class AiSummaryResponse {
  summary: string
}
