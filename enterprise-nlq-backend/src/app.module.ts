import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './ai/ai.module';
import { GuardrailsModule } from './guardrails/guardrails.module';
import { AppController } from './app.controller'; 
import { AppService } from './app.service';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { VectorSearchModule } from './vector-search/vector-search.module';
import { ReportGeneratorModule } from './report-generator/report-generator.module';
import { CronSchedulerModule } from './cron-scheduler/cron-scheduler.module';
import { ChatopsModule } from './chatops/chatops.module';

@Module({
  imports: [
    // Cấu hình này giúp các file khác đọc được file .env
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AiModule,
    GuardrailsModule,
    OrchestratorModule,
    VectorSearchModule,
    ReportGeneratorModule,
    CronSchedulerModule,
    ChatopsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}