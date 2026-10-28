import { DiscoverItemResponse } from '../../discover/response/discover-response'

export class AiSuggestionResponse {
  /** Карточка витрины с key — открывается через GET /discover/{key} */
  item: DiscoverItemResponse
  /** Почему модель это предложила */
  reason: string
}

export class AiSuggestionsResponse {
  items: AiSuggestionResponse[]
}

export class AiSummaryResponse {
  summary: string
}

export class TasteInsightResponse {
  insight: string
  /** Текст обновляется раз в неделю */
  generatedAt: Date
}
