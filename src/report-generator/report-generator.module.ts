import { Module } from '@nestjs/common';
import { ReportGeneratorService } from './report-generator.service';

@Module({
  providers: [ReportGeneratorService]
})
export class ReportGeneratorModule {}
