import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

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
  @ApiOkResponse({ type: MobileAuthResponse })
  register(@Body() dto: RegisterDto): Promise<MobileAuthResponse> {
    return this.authService.register(dto)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileAuthResponse })
  login(@Body() dto: LoginDto): Promise<MobileAuthResponse> {
    return this.authService.login(dto)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileAuthResponse })
  refresh(@Body() dto: RefreshDto): Promise<MobileAuthResponse> {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto): Promise<boolean> {
    return this.authService.logout(dto.refreshToken)
  }

  /** Расширение просит код и показывает его пользователю */
  @Post('device/code')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DeviceCodeResponse })
  createDeviceCode(): Promise<DeviceCodeResponse> {
    return this.authService.createDeviceCode()
  }

  /** Расширение опрашивает эндпоинт, пока юзер не подтвердит код */
  @Post('device/poll')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DevicePollResponse })
  pollDeviceCode(@Body() dto: DeviceCodeDto): Promise<DevicePollResponse> {
    return this.authService.pollDeviceCode(dto.code)
  }
}
