import { Module } from '@nestjs/common';
import { CronSchedulerService } from './cron-scheduler.service';

@Module({
  providers: [CronSchedulerService]
})
export class CronSchedulerModule {}
