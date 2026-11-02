import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // Để đọc biến môi trường (.env)
import { ChatopsService } from './chatops.service';
import { ChatopsController } from './chatops.controller';

@Module({
  imports: [ConfigModule], 
  controllers: [ChatopsController],
  providers: [ChatopsService],
  exports: [ChatopsService],
})
export class ChatopsModule {}