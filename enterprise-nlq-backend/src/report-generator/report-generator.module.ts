import { Module } from '@nestjs/common';
import { ReportGeneratorService } from './report-generator.service';
import { ChatopsModule } from '../chatops/chatops.module'; 
import { AiModule } from '../ai/ai.module'; 
@Module({
  imports: [ChatopsModule, AiModule], 
  providers: [ReportGeneratorService],
  exports: [ReportGeneratorService] 
})
export class ReportGeneratorModule {}