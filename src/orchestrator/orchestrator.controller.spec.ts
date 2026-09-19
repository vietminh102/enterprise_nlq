import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorController } from './orchestrator.controller';

describe('OrchestratorController', () => {
  let controller: OrchestratorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestratorController],
    }).compile();

    controller = module.get<OrchestratorController>(OrchestratorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
