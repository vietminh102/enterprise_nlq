import { Module } from '@nestjs/common';
import { VectorSearchService } from './vector-search.service';

@Module({
  providers: [VectorSearchService]
})
export class VectorSearchModule {}
