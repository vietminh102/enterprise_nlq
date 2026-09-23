import { Module } from '@nestjs/common';
import { VectorSearchService } from './vector-search.service';
import { VectorSearchController } from './vector-search.controller';

@Module({
  providers: [VectorSearchService],
  controllers: [VectorSearchController]
})
export class VectorSearchModule {}
