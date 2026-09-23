import { Module, forwardRef } from '@nestjs/common';
import { CronSchedulerService } from './cron-scheduler.service';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { ReportGeneratorModule } from '../report-generator/report-generator.module';

@Module({
  imports: [forwardRef(() => OrchestratorModule), ReportGeneratorModule], 
  providers: [CronSchedulerService],
})
export class CronSchedulerModule {}