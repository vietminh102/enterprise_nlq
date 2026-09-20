import { Test, TestingModule } from '@nestjs/testing';
import { VectorSearchController } from './vector-search.controller';

describe('VectorSearchController', () => {
  let controller: VectorSearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VectorSearchController],
    }).compile();

    controller = module.get<VectorSearchController>(VectorSearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
