import { Module } from '@nestjs/common';
import { VectorSearchService } from './vector-search.service';
import { VectorSearchController } from './vector-search.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule], 
  providers: [VectorSearchService],
  controllers: [VectorSearchController],
  exports: [VectorSearchService]
})
export class VectorSearchModule {}