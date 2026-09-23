import { Test, TestingModule } from '@nestjs/testing';
import { ChatopsService } from './chatops.service';

describe('ChatopsService', () => {
  let service: ChatopsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatopsService],
    }).compile();

    service = module.get<ChatopsService>(ChatopsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
