import { Module } from '@nestjs/common';
import { ChatopsService } from './chatops.service';

@Module({
  providers: [ChatopsService]
})
export class ChatopsModule {}
