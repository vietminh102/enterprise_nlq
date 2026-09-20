import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';

// Import các module vệ tinh
import { VectorSearchModule } from '../vector-search/vector-search.module';
import { AiModule } from '../ai/ai.module';
import { GuardrailsModule } from '../guardrails/guardrails.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    VectorSearchModule,
    AiModule,
    GuardrailsModule,
    DatabaseModule
  ],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
})
export class OrchestratorModule {}