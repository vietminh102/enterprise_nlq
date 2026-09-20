import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';

@Controller('api/query') 
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Post()
  async handleQuery(@Body('question') question: string) {
    if (!question) {
      throw new BadRequestException('Vui lòng cung cấp tham số "question" trong body JSON.');
    }
    
    return await this.orchestratorService.processNaturalLanguageQuery(question);
  }
}