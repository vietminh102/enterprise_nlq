import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';

@Module({
  imports: [ConfigModule], // Nạp Config để đọc API Key
  providers: [AiService],
  exports: [AiService],    // Xuất ra để sau này Query Module sử dụng
})
export class AiModule {}