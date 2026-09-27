import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { ReportGeneratorService } from '../report-generator/report-generator.service';
import { DatabaseService } from '../database/database.service';
import { VectorSearchService } from '../vector-search/vector-search.service';
import * as fs from 'fs';

@Injectable()
export class CronSchedulerService {
  private readonly logger = new Logger(CronSchedulerService.name);
  private currentSchemaHash: string | null = null;

  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly reportGeneratorService: ReportGeneratorService,
    private readonly dbService: DatabaseService,
    private readonly vectorSearchService: VectorSearchService 
  ) {}

  // 1. RADAR THEO DÕI DATABASE (Chạy ngầm mỗi 10 giây)
  @Interval(10000)
  async watchSchemaChanges() {
    try {
      // Dùng hàm băm MD5 của PostgreSQL để gộp toàn bộ tên bảng, tên cột thành 1 chuỗi mã hóa duy nhất
      const hashQuery = `
        SELECT md5(string_agg(table_name || column_name || data_type, '')) as schema_hash
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name != 'schema_metadata';
      `;
      
      const result = await this.dbService.executeBizQuery(hashQuery);
      const newHash = result[0]?.schema_hash;

      // Lần chạy đầu tiên khi khởi động Server: Chỉ ghi nhớ mã Hash, chưa làm gì cả
      if (this.currentSchemaHash === null) {
        this.currentSchemaHash = newHash;
        return;
      }

      // Các lần sau: Nếu mã Hash khác với mã đã nhớ -> Cấu trúc Database vừa bị thay đổi!
      if (newHash !== this.currentSchemaHash) {
        this.logger.log('⚡ Phát hiện Database Doanh nghiệp thay đổi cấu trúc!');
        this.currentSchemaHash = newHash; // Lưu lại mã mới
        
        // Tự động kích hoạt đồng bộ Vector
        await this.vectorSearchService.seedAllSchemas();
      }
    } catch (error: any) {
      // Bỏ qua lỗi nếu Neon đang tạm ngủ, sẽ tự thử lại ở chu kỳ 10 giây tiếp theo
    }
  }

  // 2. TÍNH NĂNG BÁO CÁO CŨ (Giữ nguyên)
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