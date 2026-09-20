import { Controller, Get, Query } from '@nestjs/common';
import { VectorSearchService } from './vector-search.service';

@Controller('vector-search')
export class VectorSearchController {
  constructor(private readonly vectorSearchService: VectorSearchService) {}

  // API endpoint: GET /vector-search/test?q=câu_hỏi
  @Get('test')
  async testSearch(@Query('q') q: string) {
    if (!q) {
      return { 
        status: 'Lỗi', 
        message: 'Vui lòng truyền tham số q (Ví dụ: /vector-search/test?q=doanh thu)' 
      };
    }

    console.log(`Đang test Vector Search với câu hỏi: "${q}"...`);
    
    // Gọi hàm từ service
    const results = await this.vectorSearchService.findRelevantSchemas(q);
    
    return {
      status: 'Thành công',
      question: q,
      relevant_schemas: results
    };
  }
}