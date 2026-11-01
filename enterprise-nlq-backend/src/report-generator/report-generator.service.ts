import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ChatopsService } from '../chatops/chatops.service';
import { AiService } from '../ai/ai.service'; 

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    private readonly chatopsService: ChatopsService,
    private readonly aiService: AiService
  ) {}

  // 1. CẬP NHẬT: Hàm tạo file Excel đa sheet
  async generateMultiSheetExcelReport(reportData: Record<string, any[]>): Promise<Buffer> {
    this.logger.log('Đang tạo báo cáo Excel (Full screen & Total row)...');
    const workbook = new ExcelJS.Workbook();
    
    for (const [sheetName, data] of Object.entries(reportData)) {
      if (!data || data.length === 0) continue;

      const worksheet = workbook.addWorksheet(sheetName);
      const keys = Object.keys(data[0]);

      // TĂNG KÍCH THƯỚC CỘT: Mặc định là 50 (to gấp đôi bình thường) để lấp đầy màn hình
      worksheet.columns = keys.map((key) => ({
        header: key.toUpperCase().replace(/_/g, ' '), 
        key: key,
        width: 50, 
      }));

      // Định dạng Header: Font to, in đậm, nền xanh doanh nghiệp
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30; // Tiêu đề cao hơn

      // Đổ dữ liệu và định dạng font to hơn
      data.forEach((row) => {
        const newRow = worksheet.addRow(row);
        newRow.font = { size: 12 };
      });

      // TÍNH TỔNG TỰ ĐỘNG CHO CÁC CỘT SỐ
      const totalsRow: any = {};
      let hasNumericColumn = false;
      
      keys.forEach((key, index) => {
        if (index === 0) {
          totalsRow[key] = 'TỔNG CỘNG:'; // Cột đầu tiên ghi chữ Tổng Cộng
        } else {
          // Nếu cột này chứa số, tính tổng
          const isNumeric = data.some(item => !isNaN(Number(item[key])));
          if (isNumeric) {
            const sum = data.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
            totalsRow[key] = sum;
            hasNumericColumn = true;
          } else {
            totalsRow[key] = '';
          }
        }
      });

      // Nếu có cột chứa số lượng/tiền thì mới thêm dòng TỔNG CỘNG
      if (hasNumericColumn) {
        const totalRowElement = worksheet.addRow(totalsRow);
        totalRowElement.font = { bold: true, size: 13, color: { argb: 'FF990000' } }; // Chữ màu đỏ đô
        totalRowElement.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; // Nền xám nhạt
      }

      // Kẻ khung (Borders) cho toàn bộ bảng (kể cả dòng tổng)
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        });
      });
    }

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }
  // 2. CẬP NHẬT: Gửi nội dung email tối giản và đính kèm báo cáo đa sheet
  async processAndSendComprehensiveReport(
    reportTitle: string, 
    allData: Record<string, any[]>, 
    recipients: { channel: 'email' | 'zalo' | 'slack', address: string }[]
  ) {
    this.logger.log(`Bắt đầu xử lý và gửi báo cáo tổng hợp: ${reportTitle}`);

    try {
      // Gọi AI phân tích dựa trên một sheet chính (ví dụ: Tổng Doanh Thu)
      let aiInsight = "Không thể sinh nhận xét tự động.";
      const mainData = allData['Tổng Doanh Thu'] || Object.values(allData)[0];
      
      if (mainData) {
        const dataStr = JSON.stringify(mainData).substring(0, 1000); 
        const aiPrompt = `Đóng vai giám đốc kinh doanh, hãy viết một đoạn nhận xét chuyên sâu (3-4 câu) về tình hình doanh thu từ dữ liệu sau: ${dataStr}. Nêu bật điểm tích cực và đề xuất hành động nếu có.`;
        try {
          aiInsight = await this.aiService.generateDataInsights(aiPrompt, mainData);
        } catch (e: any) {
          this.logger.warn(`Lỗi khi gọi AI: ${e.message}`);
        }
      }

      // Tạo File Excel đa sheet
      let excelAttachment = undefined;
      try {
        const excelBuffer = await this.generateMultiSheetExcelReport(allData);
        excelAttachment = {
          filename: `Bao_Cao_Tong_Hop_${new Date().toISOString().split('T')[0]}.xlsx`,
          buffer: excelBuffer
        };
      } catch (e: any) {
        this.logger.warn(`Không thể tạo file Excel: ${e.message}`);
      }

      // Format Email - ĐÃ XÓA CHART TYPE VÀ BẢNG SỐ LIỆU THÔ
      const reportFormat = `
Kính gửi Ban Giám Đốc,

Dưới đây là **${reportTitle.toUpperCase()}**.

🧠 **AI Phân Tích & Đánh Giá:**
${aiInsight}

Chi tiết về doanh thu, top sản phẩm và tình trạng tồn kho đã được tổng hợp trong file Excel đính kèm. 

Trân trọng,
Hệ thống Enterprise NLQ Assistant.
      `;

      for (const user of recipients) {
         const success = await this.chatopsService.sendNotification(user.channel, user.address, reportFormat, excelAttachment);
         if (success) {
            this.logger.log(`✅ Đã gửi báo cáo thành công tới ${user.address}`);
         }
      }
    } catch (err: any) {
      this.logger.error(`Lỗi hệ thống khi tạo và gửi báo cáo: ${err.message}`);
    }
  }
}