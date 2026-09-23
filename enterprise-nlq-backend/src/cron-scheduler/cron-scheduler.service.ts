import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { ReportGeneratorService } from '../report-generator/report-generator.service';
import * as fs from 'fs';

@Injectable()
export class CronSchedulerService {
  private readonly logger = new Logger(CronSchedulerService.name);

  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly reportGeneratorService: ReportGeneratorService
  ) {}

 @Cron('0 8 * * *')
  async handleAutomatedInsights() {
    this.logger.log('Bắt đầu tiến trình Automated Insights (Báo cáo định kỳ)...');

    try {
      const autoQuery = "Lấy danh sách 5 khách hàng mới nhất.";
      const reportData = await this.orchestratorService.processNaturalLanguageQuery(autoQuery);

      if (reportData.data && reportData.data.length > 0) {
        const excelBuffer = await this.reportGeneratorService.generateExcelReport(reportData.data, 'Báo Cáo Tuần');
        
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