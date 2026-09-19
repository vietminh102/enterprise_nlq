import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';

@Module({
  providers: [OrchestratorService],
  controllers: [OrchestratorController]
})
export class OrchestratorModule {}
