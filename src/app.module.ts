import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { DatabaseModule } from './database/database.module';
import { AiModule } from './ai/ai.module';
import { GuardrailsModule } from './guardrails/guardrails.module';
import { QueryModule } from './query/query.module';
import { AppController } from './app.controller'; 
import { AppService } from './app.service';

@Module({
  imports: [
    // Cấu hình này giúp các file khác đọc được file .env
    ConfigModule.forRoot({ isGlobal: true }), 
    DatabaseModule,
    AiModule,
    GuardrailsModule,
    QueryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}