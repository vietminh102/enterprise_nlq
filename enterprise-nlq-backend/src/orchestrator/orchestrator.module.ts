import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';

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
  exports: [OrchestratorService] // Bắt buộc phải có dòng này để chia sẻ service
})
export class OrchestratorModule {}