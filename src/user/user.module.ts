import { Module } from '@nestjs/common'

import { AiModule } from '../ai/ai.module'

import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [AiModule],
  controllers: [UserController],
  providers: [UserService]
})
export class UserModule {}
