import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';

import { VectorSearchModule } from '../vector-search/vector-search.module';
import { AiModule } from '../ai/ai.module';
import { GuardrailsModule } from '../guardrails/guardrails.module';
import { DatabaseModule } from '../database/database.module';
import { ChatopsModule } from '../chatops/chatops.module'; 
import { ReportGeneratorModule } from '../report-generator/report-generator.module';


@Module({
  imports: [
    VectorSearchModule,
    AiModule,
    GuardrailsModule,
    DatabaseModule,
    ChatopsModule,         
    ReportGeneratorModule
  ],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
  exports: [OrchestratorService] 
})
export class OrchestratorModule {}