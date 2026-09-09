import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'

import {
  REFRESH_TOKEN_NAME,
  REFRESH_TOKEN_TTL_MS
} from '../constants/auth.constants'

import { AuthService } from './auth.service'
import { Auth } from './decorators/auth.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import { DeviceCodeDto } from './dto/device-code.dto'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { AuthResponse } from './response/auth-response'

/**
 * Веб-клиент: refresh-токен живёт только в httpOnly-куке.
 * В теле ответа его нет — JS не должен иметь к нему доступа.
 * Мобильное приложение и расширение ходят в /auth/mobile.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOkResponse({ type: AuthResponse })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponse> {
    const { refreshToken, ...auth } = await this.authService.register(dto)

    this._setRefreshCookie(res, refreshToken)

    return auth
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponse })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponse> {
    const { refreshToken, ...auth } = await this.authService.login(dto)

    this._setRefreshCookie(res, refreshToken)

    return auth
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponse })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponse> {
    const token = req.cookies?.[REFRESH_TOKEN_NAME]

    if (!token) throw new UnauthorizedException('Token is missing')

    const { refreshToken, ...auth } = await this.authService.refresh(token)

    this._setRefreshCookie(res, refreshToken)

    return auth
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<boolean> {
    res.clearCookie(REFRESH_TOKEN_NAME)

    return this.authService.logout(req.cookies?.[REFRESH_TOKEN_NAME])
  }

  /** Подтверждение кода из расширения — юзер уже авторизован в вебе */
  @Post('device/approve')
  @HttpCode(HttpStatus.OK)
  @Auth()
  approveDevice(
    @Body() dto: DeviceCodeDto,
    @CurrentUser('id') userId: string
  ): Promise<boolean> {
    return this.authService.approveDeviceCode(dto.code, userId)
  }

  private _setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_TOKEN_NAME, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_TTL_MS
    })
  }
}
