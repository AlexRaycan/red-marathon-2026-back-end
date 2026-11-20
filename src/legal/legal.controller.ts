import { applyDecorators, Controller, Get, Header } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'

import { ILegalPage, renderLegalPage } from './legal-page.layout'
import {
  ATTRIBUTION_PAGE,
  PRIVACY_PAGE,
  SUPPORT_PAGE,
  TERMS_PAGE
} from './legal.pages'

const HtmlPage = (path: string) =>
  applyDecorators(Get(path), Header('Content-Type', 'text/html; charset=utf-8'))

@ApiExcludeController()
@Controller()
export class LegalController {
  @HtmlPage('privacy')
  privacy(): string {
    return this._render(PRIVACY_PAGE)
  }

  @HtmlPage('support')
  support(): string {
    return this._render(SUPPORT_PAGE)
  }

  @HtmlPage('terms')
  terms(): string {
    return this._render(TERMS_PAGE)
  }

  @HtmlPage('attribution')
  attribution(): string {
    return this._render(ATTRIBUTION_PAGE)
  }

  private _render(page: ILegalPage): string {
    return renderLegalPage(page)
  }
}
