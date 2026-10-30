import { Module } from '@nestjs/common';
import { CronSchedulerService } from './cron-scheduler.service';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { ReportGeneratorModule } from '../report-generator/report-generator.module';
import { DatabaseModule } from '../database/database.module'; 
import { VectorSearchModule } from '../vector-search/vector-search.module'; 

@Module({
  imports: [
    OrchestratorModule, 
    ReportGeneratorModule,
    DatabaseModule,      
    VectorSearchModule   
  ],
  providers: [CronSchedulerService],
})
export class CronSchedulerModule {}