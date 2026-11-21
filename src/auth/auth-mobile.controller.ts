import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards
} from '@nestjs/common'
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'

import {
  AUTH_RATE_TTL_MS,
  LOGIN_RATE_LIMIT,
  REGISTER_RATE_LIMIT
} from '../constants/auth.constants'

import { AuthService } from './auth.service'
import { DeviceCodeDto } from './dto/device-code.dto'
import { LoginDto } from './dto/login.dto'
import { RefreshDto } from './dto/refresh.dto'
import { RegisterDto } from './dto/register.dto'
import { MobileAuthResponse } from './response/auth-response'
import {
  DeviceCodeResponse,
  DevicePollResponse
} from './response/device-code-response'

/**
 * Мобильное приложение (React Native) и браузерное расширение.
 * Куки им недоступны, поэтому refresh-токен уходит в теле ответа —
 * клиент сам кладёт его в SecureStore или chrome.storage.
 */
@ApiTags('auth-mobile')
@Controller('auth/mobile')
export class AuthMobileController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: REGISTER_RATE_LIMIT, ttl: AUTH_RATE_TTL_MS } })
  @ApiOperation({ operationId: 'mobileRegister' })
  @ApiCreatedResponse({ type: MobileAuthResponse })
  register(@Body() dto: RegisterDto): Promise<MobileAuthResponse> {
    return this.authService.register(dto)
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: AUTH_RATE_TTL_MS } })
  @ApiOperation({ operationId: 'mobileLogin' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileAuthResponse })
  login(@Body() dto: LoginDto): Promise<MobileAuthResponse> {
    return this.authService.login(dto)
  }

  @Post('refresh')
  @ApiOperation({ operationId: 'mobileRefreshTokens' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileAuthResponse })
  refresh(@Body() dto: RefreshDto): Promise<MobileAuthResponse> {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('logout')
  @ApiOperation({ operationId: 'mobileLogout' })
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto): Promise<boolean> {
    return this.authService.logout(dto.refreshToken)
  }

  /** Расширение просит код и показывает его пользователю */
  @Post('device/code')
  @ApiOperation({ operationId: 'createDeviceCode' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeviceCodeResponse })
  createDeviceCode(): Promise<DeviceCodeResponse> {
    return this.authService.createDeviceCode()
  }

  /** Расширение опрашивает эндпоинт, пока юзер не подтвердит код */
  @Post('device/poll')
  @ApiOperation({ operationId: 'pollDeviceCode' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DevicePollResponse })
  pollDeviceCode(@Body() dto: DeviceCodeDto): Promise<DevicePollResponse> {
    return this.authService.pollDeviceCode(dto.code)
  }
}
