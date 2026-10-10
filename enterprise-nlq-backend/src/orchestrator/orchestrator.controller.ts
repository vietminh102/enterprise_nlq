import { 
  Controller, 
  Post, 
  Body, 
  BadRequestException, 
  Headers, 
  Logger 
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OrchestratorService } from './orchestrator.service';

@Controller('api/query') 
export class OrchestratorController {
  private readonly logger = new Logger(OrchestratorController.name);
  
  // Thiết lập thời gian timeout (VD: 15 giây)
  private readonly TIMEOUT_MS = 15000; 

  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Post()
  async handleQuery(
    @Body('question') question: string,
    @Headers('x-request-id') clientRequestId?: string, // Hỗ trợ nhận Request ID từ Frontend nếu có
  ) {
    if (!question) {
      throw new BadRequestException('Vui lòng cung cấp tham số "question" trong body JSON.');
    }
    
    // 1. Tạo Request ID để tracking (ưu tiên ID từ client, nếu không có thì tự tạo)
    const requestId = clientRequestId || randomUUID();
    this.logger.log(`[${requestId}] Nhận truy vấn: "${question}"`);

    // 2. Tạo Promise thực thi luồng chính
    const processPromise = this.orchestratorService.processNaturalLanguageQuery(question)
      .then(result => ({
        requestId,
        status: 'SUCCESS',
        is_partial: false,
        ...result // Trải phẳng dữ liệu trả về (data, chart_type, explanation...)
      }))
      .catch(error => {
        this.logger.error(`[${requestId}] Lỗi xử lý: ${error.message}`, error.stack);
        return {
          requestId,
          status: 'ERROR',
          is_partial: false,
          error: 'Đã xảy ra lỗi trong quá trình phân tích dữ liệu.',
          error_type: error.name || 'UNKNOWN_ERROR',
        };
      });

    // 3. Tạo Promise đếm ngược Timeout trả về Partial Result
    const timeoutPromise = new Promise<any>((resolve) => {
      setTimeout(() => {
        this.logger.warn(`[${requestId}] Timeout sau ${this.TIMEOUT_MS}ms. Trả về partial result.`);
        resolve({
          requestId,
          status: 'PARTIAL',
          is_partial: true,
          data: [], // Hoặc một dữ liệu mặc định/dữ liệu đã phân tích được một phần
          chart_type: 'table',
          explanation: 'Truy vấn mất quá nhiều thời gian để thực thi. Đây là kết quả phản hồi tạm thời.',
          error: 'Hệ thống đang quá tải hoặc truy vấn quá phức tạp.',
          error_type: 'TIMEOUT'
        });
      }, this.TIMEOUT_MS);
    });

    // 4. Tranh chấp Promise: Cái nào xong trước sẽ được trả về client
    const finalResult = await Promise.race([processPromise, timeoutPromise]);

    this.logger.log(`[${requestId}] Hoàn thành với trạng thái: ${finalResult.status}`);
    return finalResult;
  }
}