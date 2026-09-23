import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { ReportGeneratorService } from '../report-generator/report-generator.service';
import * as fs from 'fs'; // Dùng để lưu file ra ổ cứng test thử

@Injectable()
export class CronSchedulerService {
  private readonly logger = new Logger(CronSchedulerService.name);

  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly reportGeneratorService: ReportGeneratorService // Inject service vào đây
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS) // Đang để 10 giây để test
  async handleAutomatedInsights() {
    this.logger.log('Bắt đầu tiến trình Automated Insights (Báo cáo định kỳ)...');

    try {
      const autoQuery = "Lấy danh sách 5 khách hàng mới nhất."; // Thay câu hỏi phù hợp với DB của bạn
      const reportData = await this.orchestratorService.processNaturalLanguageQuery(autoQuery);

      if (reportData.data && reportData.data.length > 0) {
        // Gọi module report-generator để tạo file Excel
        const excelBuffer = await this.reportGeneratorService.generateExcelReport(reportData.data, 'Báo Cáo Tuần');
        
        // Lưu thử file ra ổ cứng để kiểm tra (Trong thực tế sẽ đính kèm vào email)
        const fileName = `Bao_Cao_Tự_Động_${new Date().getTime()}.xlsx`;
        fs.writeFileSync(fileName, excelBuffer);
        
        this.logger.log(`Đã xuất file báo cáo ra ổ cứng với tên: ${fileName}`);
      } else {
        this.logger.log('Không có dữ liệu để tạo file Excel.');
      }

    } catch (error: any) {
      this.logger.error('Lỗi khi chạy Automated Insights:', error.message);
    }
  }
}