import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { ReportGeneratorService } from '../report-generator/report-generator.service';
import { DatabaseService } from '../database/database.service';
import { VectorSearchService } from '../vector-search/vector-search.service';
import * as crypto from 'crypto';

@Injectable()
export class CronSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CronSchedulerService.name);
  private currentSchemaHash: string | null = null;

  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly reportGeneratorService: ReportGeneratorService,
    private readonly dbService: DatabaseService,
    private readonly vectorSearchService: VectorSearchService,
  ) {}

  onApplicationBootstrap() {
    this.logger.log('⏳ Đang chuẩn bị chạy thử nghiệm báo cáo tự động sau 3 giây...');
    setTimeout(() => {
      this.handleAutomatedInsights();
    }, 3000);
  }

  @Interval(10000)
  async watchSchemaChanges() {
    // ... (Giữ nguyên logic radar) ...
  }

  @Cron('0 8 * * *') 
  async handleAutomatedInsights() {
    this.logger.log('🚀 Bắt đầu chạy CronJob báo cáo ban giám đốc...');

    try {
      // 1. TÍNH TOÁN NGÀY HÔM QUA (CHUẨN XÁC) TỪ SERVER
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      // Chuyển về định dạng YYYY-MM-DD (Ví dụ: 2026-10-31) để đưa vào SQL an toàn nhất
      const targetDate = yesterday.toISOString().split('T')[0]; 
      
      // Chuyển về định dạng DD/MM/YYYY (Ví dụ: 31/10/2026) để viết tiêu đề Email cho đẹp
      const formattedDate = yesterday.toLocaleDateString('vi-VN');

      const mockReport = {
        title: `Báo Cáo Hoạt Động Kinh Doanh Ngày ${formattedDate}`,
        recipients: [
          { channel: 'email', address: 'thongbaolovee@gmail.com' } 
        ] as { channel: 'email' | 'zalo' | 'slack'; address: string }[],
      };

      const sessionId = crypto.randomUUID();
      const allReportData: Record<string, any[]> = {};

      // 2. TRUYỀN NGÀY CỤ THỂ VÀO CÂU HỎI
this.logger.log(`Đang lấy dữ liệu Tổng Doanh Thu cho ngày ${targetDate}...`);
      const revRes = await this.orchestratorService.processNaturalLanguageQuery(
        sessionId, 
        `Thống kê tổng doanh thu bán hàng của TỪNG DANH MỤC SẢN PHẨM. BẮT BUỘC dùng mệnh đề WHERE để lọc chính xác các đơn hàng có order_date = '${targetDate}'. Nếu ngày này không có đơn hàng nào, BẮT BUỘC trả về mảng rỗng. Hiển thị Tên danh mục và Tổng tiền.`
      );
      // Chỉ lấy nếu mảng trả về thực sự có dữ liệu
      if (revRes.data && revRes.data.length > 0) allReportData['Tổng Doanh Thu'] = revRes.data;

      this.logger.log(`Đang lấy dữ liệu Top 10 Sản Phẩm cho ngày ${targetDate}...`);
      const topProdRes = await this.orchestratorService.processNaturalLanguageQuery(
        sessionId, 
        `Thống kê 10 sản phẩm bán chạy nhất. BẮT BUỘC dùng mệnh đề WHERE để lọc chính xác các đơn hàng có order_date = '${targetDate}'. Nếu ngày này không có đơn hàng, trả về rỗng. Hiển thị Tên sản phẩm và Tổng số lượng bán.`
      );
      if (topProdRes.data && topProdRes.data.length > 0) allReportData['Top 10 Sản Phẩm'] = topProdRes.data;

      // Tồn kho là dữ liệu hiện tại, không phụ thuộc ngày hôm qua
      this.logger.log('Đang lấy dữ liệu: Tồn Kho hiện tại...');
      const stockRes = await this.orchestratorService.processNaturalLanguageQuery(
        sessionId, 
        'Thống kê lượng hàng tồn kho (stock) hiện tại của các sản phẩm. Chỉ lấy những sản phẩm còn hàng.'
      );
      if (stockRes.data) allReportData['Tồn Kho'] = stockRes.data;

      // 3. GỬI BÁO CÁO
      if (Object.keys(allReportData).length > 0) {
        await this.reportGeneratorService.processAndSendComprehensiveReport(
          mockReport.title,
          allReportData,
          mockReport.recipients,
        );
        this.logger.log(`🎉 Hoàn thành gửi báo cáo tổng hợp cho ngày ${formattedDate}!`);
      } else {
        this.logger.warn('Không có dữ liệu nào trả về để tạo báo cáo.');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi chạy báo cáo tổng hợp: ${errorMessage}`);
    }
  }
}